import { z } from "zod";

export const createHabitSchema = z.object({
  name: z.string().trim().min(1, "O nome do hábito não pode ficar vazio"),
  categoryId: z.number().int().positive("Escolha uma categoria"),
});

export type CreateHabit = z.infer<typeof createHabitSchema>;
