"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function BackToCarsLink() {
  const { t } = useLanguage();

  return (
    <Link
      href="/cars"
      className="inline-flex w-fit items-center gap-2 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft size={16} />
      {t("cars.backToAll")}
    </Link>
  );
}
