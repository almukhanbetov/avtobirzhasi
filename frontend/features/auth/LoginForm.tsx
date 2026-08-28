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
import { postAuthPath } from "@/lib/auth/postAuthPath";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function LoginForm() {
  const { t } = useLanguage();
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
      // Role-based: an admin logging in lands on /admin, everyone else on
      // /dashboard. `user` here is the fresh login response, so its role
      // is authoritative. replace(), not push(), so Back doesn't return
      // to the login form.
      router.replace(postAuthPath(user));
    } catch (err) {
      setApiError(
        err instanceof ApiError ? err.message : t("auth.loginError"),
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {apiError ? (
        <p className="text-[13px] text-destructive">{apiError}</p>
      ) : null}
      <Input
        label={t("auth.phone")}
        type="tel"
        placeholder="+7 707 123 45 67"
        error={errors.phone?.message}
        {...register("phone")}
      />
      <PasswordInput
        label={t("auth.password")}
        placeholder={t("auth.enterPassword")}
        error={errors.password?.message}
        {...register("password")}
      />
      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? t("auth.loggingIn") : t("header.login")}
      </Button>
    </form>
  );
}
