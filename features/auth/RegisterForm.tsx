"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { registerSchema, type RegisterFormValues } from "@/lib/validation/auth";
import { register as registerAccount } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";

export function RegisterForm() {
  const router = useRouter();
  const { login: setSession } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const { token, user } = await registerAccount(values);
      setSession(token, user);
      router.push("/dashboard");
    } catch (err) {
      setApiError(
        err instanceof ApiError
          ? err.message
          : "Не удалось создать аккаунт, попробуйте позже",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {apiError ? (
        <p className="text-[13px] text-destructive">{apiError}</p>
      ) : null}
      <Input
        label="Имя"
        placeholder="Данияр Кенжебаев"
        error={errors.name?.message}
        {...register("name")}
      />
      <Input
        label="Телефон"
        type="tel"
        placeholder="+7 707 123 45 67"
        error={errors.phone?.message}
        {...register("phone")}
      />
      <PasswordInput
        label="Пароль"
        placeholder="Не менее 6 символов"
        error={errors.password?.message}
        {...register("password")}
      />
      <PasswordInput
        label="Повторите пароль"
        placeholder="Ещё раз пароль"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? "Создаём аккаунт…" : "Создать аккаунт"}
      </Button>
    </form>
  );
}
