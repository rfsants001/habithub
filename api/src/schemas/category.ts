import { z } from "zod";

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, {
    error: "A cor precisa ser um hex #rrggbb (ex: #3fb950)",
  });

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "O nome da categoria não pode ficar vazio").max(60, "Use até 60 caracteres"),
  color: hexColor,
});

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1, "O nome da categoria não pode ficar vazio").max(60, "Use até 60 caracteres"),
    color: hexColor,
  })
  .partial()
  .refine((data) => data.name !== undefined || data.color !== undefined, {
    error: "Informe ao menos um campo para editar",
  });

export type CreateCategory = z.infer<typeof createCategorySchema>;
export type UpdateCategory = z.infer<typeof updateCategorySchema>;
