import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "O nome da categoria não pode ficar vazio"),
  colorHue: z
    .number()
    .int("A cor precisa ser um número inteiro")
    .min(0, "A cor vai de 0 a 360")
    .max(360, "A cor vai de 0 a 360"),
});

export type CreateCategory = z.infer<typeof createCategorySchema>;
