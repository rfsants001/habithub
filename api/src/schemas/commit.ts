import { z } from "zod";

export const createCommitSchema = z.object({
  message: z.string().trim().max(200).optional(),
});

export type CreateCommit = z.infer<typeof createCommitSchema>;
