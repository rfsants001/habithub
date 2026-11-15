import { afterAll, beforeEach, expect, test } from 'vitest';
import { db } from '../db/client';
import { categories, entries, habits } from '../db/schema';
import { importBackup } from '../db/backup';
import { today, weekBounds } from '../db/date';
import { createServer } from '../server';

const app = createServer();
const clear = () => { db.delete(entries).run(); db.delete(habits).run(); db.delete(categories).run(); };
beforeEach(clear);
afterAll(() => app.close());

const request = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) => app.inject({ method, url, payload });
async function makeHabits() {
  const category = (await request('POST', '/categories', { name: 'Bem-estar', color: '#8DBB96' })).json();
  const habit = (await request('POST', '/habits', { name: 'Treinar', categoryId: category.id, daysPerWeek: 3 })).json();
  const other = (await request('POST', '/habits', { name: 'Ler', categoryId: category.id })).json();
  return { category, habit, other };
}

test('weekly progress counts distinct dates, and retains archived habits for management', async () => {
  const { habit, other } = await makeHabits();
  const date = weekBounds().start;
  // Legacy data already contains two entries on one date. The migration preserves both.
  db.insert(entries).values([{ habitId: habit.id, date }, { habitId: habit.id, date }]).run();
  await request('PATCH', `/habits/${other.id}`, { active: false });
  const overview = (await request('GET', '/overview')).json();
  expect(overview).toMatchObject({ today: today(), habits: [
    { id: habit.id, daysPerWeek: 3, totalCommits: 2, weekCount: 1, weekDates: [date] },
    { id: other.id, daysPerWeek: 7, active: false },
  ] });
  expect((await request('PATCH', `/habits/${habit.id}`, { daysPerWeek: 0 })).statusCode).toBe(400);
});

test('undo removes only the requested habit entry, and the history reflects that', async () => {
  const { habit, other } = await makeHabits();
  const recorded = (await request('POST', `/habits/${habit.id}/commit`, { message: 'uma nota' })).json();
  const path = `/habits/${habit.id}/history?month=${today().slice(0, 7)}`;
  await request('DELETE', `/habits/${other.id}/entries/${recorded.entryId}`);
  expect((await request('GET', path)).json().entries).toMatchObject([{ id: recorded.entryId, message: 'uma nota' }]);
  expect((await request('DELETE', `/habits/${habit.id}/entries/${recorded.entryId}`)).statusCode).toBe(204);
  expect((await request('GET', path)).json().entries).toEqual([]);
  expect((await request('GET', '/overview')).json().habits[0]).toMatchObject({ doneToday: false, weekCount: 0 });
});

test('backup round-trips notes, scheduling and archive state; invalid restore is atomic', async () => {
  const { habit } = await makeHabits();
  await request('POST', `/habits/${habit.id}/commit`, { message: 'nota pessoal' });
  await request('PATCH', `/habits/${habit.id}`, { active: false });
  const response = await request('GET', '/backup');
  expect(response.headers['cache-control']).toBe('no-store');
  const data = response.json();
  expect(() => importBackup(data)).toThrow('banco vazio');
  clear();
  expect(() => importBackup({ ...data, entries: [{ ...data.entries[0], habitId: 9999 }] })).toThrow();
  expect(db.select().from(categories).all()).toEqual([]);
  importBackup(data);
  expect((await request('GET', '/backup')).json()).toMatchObject({
    version: 1, categories: data.categories, habits: data.habits, entries: data.entries,
  });
});

test('cross-site browser requests cannot read a backup', async () => {
  const result = await app.inject({ method: 'GET', url: '/backup', headers: { 'sec-fetch-site': 'cross-site' } });
  expect(result.statusCode).toBe(403);
});

test('the notebook week can start in the previous year', () => {
  expect(weekBounds(new Date(2026, 0, 1, 12))).toEqual({ start: '2025-12-29', end: '2026-01-04' });
});
