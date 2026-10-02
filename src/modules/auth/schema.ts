import { z } from "zod";

export const registerBody = z.object({
  email: z.email("E-mail invalide").transform((v) => v.toLowerCase().trim()),
  password: z.string().min(8, "8 caractères minimum").max(200),
  name: z.string().trim().min(1, "Nom requis").max(120),
  phone: z.string().trim().max(30).optional(),
});

export const loginBody = z.object({
  email: z.email("E-mail invalide").transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Mot de passe requis"),
});

export const magicRequestBody = z.object({
  email: z.email("E-mail invalide").transform((v) => v.toLowerCase().trim()),
});

export const magicVerifyBody = z.object({ token: z.string().min(10) });
