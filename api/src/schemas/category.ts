import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "O nome da categoria não pode ficar vazio"),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, {
      message: "A cor precisa ser um hex #rrggbb (ex: #3fb950)",
    }),
});

export type CreateCategory = z.infer<typeof createCategorySchema>;
