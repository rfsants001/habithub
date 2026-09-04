import { z } from "zod";

export const createHabitSchema = z.object({
  name: z.string().trim().min(1, "O nome do hábito não pode ficar vazio"),
  categoryId: z.number().int().positive("Escolha uma categoria"),
});

export type CreateHabit = z.infer<typeof createHabitSchema>;

export const updateHabitSchema = z.object({
  active: z.boolean(),
});

export type UpdateHabit = z.infer<typeof updateHabitSchema>;

export const listHabitsQuerySchema = z.object({
  includeArchived: z
    .enum(["true", "false"], "Use includeArchived=true ou false")
    .default("false")
    .transform((valor) => valor === "true"),
});
