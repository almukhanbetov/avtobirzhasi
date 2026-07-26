"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { loginSchema, type LoginFormValues } from "@/lib/validation/auth";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";

export function LoginForm() {
  const router = useRouter();
  const { login: setSession } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const { token, user } = await login(values);
      setSession(token, user);
      router.push("/dashboard");
    } catch (err) {
      setApiError(
        err instanceof ApiError ? err.message : "Не удалось войти, попробуйте позже",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {apiError ? (
        <p className="text-[13px] text-destructive">{apiError}</p>
      ) : null}
      <Input
        label="Телефон"
        type="tel"
        placeholder="+7 707 123 45 67"
        error={errors.phone?.message}
        {...register("phone")}
      />
      <PasswordInput
        label="Пароль"
        placeholder="Введите пароль"
        error={errors.password?.message}
        {...register("password")}
      />
      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? "Входим…" : "Войти"}
      </Button>
    </form>
  );
}
