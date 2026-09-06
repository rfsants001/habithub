import { z } from "zod";
import { today } from "../db/date";

function isRealDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

const commitDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    error: "A data precisa estar no formato AAAA-MM-DD",
    abort: true,
  })
  .refine(isRealDay, {
    error: "Essa data não existe no calendário",
    abort: true,
  })
  .refine((value) => value <= today(), {
    error: "A data não pode estar no futuro",
    abort: true,
  })
  .refine((value) => value.slice(0, 4) === today().slice(0, 4), {
    error: "A data precisa ser deste ano",
  });

export const createCommitSchema = z.object({
  message: z.string().trim().max(200).optional(),
  date: commitDate.optional(),
});

export type CreateCommit = z.infer<typeof createCommitSchema>;
