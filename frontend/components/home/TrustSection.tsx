"use client";

import { CheckCircle2, Lock, Unlock } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function TrustSection() {
  const { t } = useLanguage();

  const checklist = [
    t("home.trust.checklist1"),
    t("home.trust.checklist2"),
    t("home.trust.checklist3"),
  ];

  return (
    <section className="py-20 sm:py-28">
      <Container className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-6">
          <SectionHeader
            eyebrow={t("home.trust.eyebrow")}
            title={t("home.trust.title")}
            description={t("home.trust.description")}
          />
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {t("home.trust.note")}
          </p>
        </div>

        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-light text-brand">
              <Lock size={20} />
            </span>
            <span className="text-[15px] font-medium text-muted-foreground">
              {t("home.trust.matchCreated")}
            </span>
          </div>

          <ul className="flex flex-col gap-3 border-y border-border py-5">
            {checklist.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 text-[15px] text-foreground"
              >
                <CheckCircle2 size={18} className="shrink-0 text-success" />
                {item}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-light text-success">
              <Unlock size={20} />
            </span>
            <span className="text-[15px] font-medium text-foreground">
              {t("home.trust.contactsOpen")}
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}
