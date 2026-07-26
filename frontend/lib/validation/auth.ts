import { z } from "zod";

function normalizeKzPhone(value: string): string {
  const cleaned = value.replace(/[\s()-]/g, "");

  // Kazakhstan numbers are commonly typed as 8XXXXXXXXXX, 7XXXXXXXXXX,
  // or a bare 10-digit local number — normalize all of these to +7XXXXXXXXXX.
  if (/^8\d{10}$/.test(cleaned)) return `+7${cleaned.slice(1)}`;
  if (/^7\d{10}$/.test(cleaned)) return `+${cleaned}`;
  if (/^\d{10}$/.test(cleaned)) return `+7${cleaned}`;

  return cleaned;
}

const phoneSchema = z
  .string()
  .min(1, "Введите номер телефона")
  .transform(normalizeKzPhone)
  .pipe(
    z
      .string()
      .regex(/^\+7\d{10}$/, "Введите номер в формате +7 707 123 45 67 или 8 707 123 45 67"),
  );

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(6, "Минимум 6 символов"),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "Введите имя"),
    phone: phoneSchema,
    password: z.string().min(6, "Минимум 6 символов"),
    confirmPassword: z.string().min(6, "Минимум 6 символов"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
