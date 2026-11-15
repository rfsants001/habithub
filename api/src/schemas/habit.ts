import { z } from "zod";

const habitName = z
  .string()
  .trim()
  .min(1, "O nome do hábito não pode ficar vazio")
  .max(80, "Use até 80 caracteres no nome");
const daysPerWeek = z.number().int().min(1).max(7);
const habitCategory = z.number().int().positive("Escolha uma categoria");

export const createHabitSchema = z.object({
  name: habitName,
  categoryId: habitCategory,
  daysPerWeek: daysPerWeek.default(7),
});

export type CreateHabit = z.infer<typeof createHabitSchema>;

export const updateHabitSchema = z
  .object({
    name: habitName,
    categoryId: habitCategory,
    active: z.boolean(),
    daysPerWeek,
  })
  .partial()
  .refine(
    (data) =>
      data.name !== undefined ||
      data.categoryId !== undefined ||
      data.daysPerWeek !== undefined ||
      data.active !== undefined,
    {
      error: "Informe ao menos um campo para editar",
    },
  );

export type UpdateHabit = z.infer<typeof updateHabitSchema>;

export const listHabitsQuerySchema = z.object({
  includeArchived: z
    .enum(["true", "false"], "Use includeArchived=true ou false")
    .default("false")
    .transform((valor) => valor === "true"),
});
