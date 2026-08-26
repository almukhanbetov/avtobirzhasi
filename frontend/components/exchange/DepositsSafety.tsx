"use client";

import { Lock, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { MatchLifecycle } from "@/components/exchange/MatchLifecycle";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function DepositsSafety() {
  const { t } = useLanguage();

  return (
    <section className="bg-surface py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeader
          eyebrow={t("exchange.depositsSafety.eyebrow")}
          title={t("exchange.depositsSafety.title")}
          description={t("exchange.depositsSafety.description")}
        />

        <MatchLifecycle />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex items-start gap-4 rounded-2xl border border-border bg-background p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand">
              <Lock size={20} />
            </span>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {t("exchange.depositsSafety.note1")}
            </p>
          </div>
          <div className="flex items-start gap-4 rounded-2xl border border-border bg-background p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-light text-success">
              <ShieldCheck size={20} />
            </span>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {t("exchange.depositsSafety.note2")}
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
