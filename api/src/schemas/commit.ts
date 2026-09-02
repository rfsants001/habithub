import { z } from "zod";

export const createHabitSchema = z.object({
  message: z.string().trim().max(200).optional(),
});

export type CreateHabit = z.infer<typeof createHabitSchema>;
