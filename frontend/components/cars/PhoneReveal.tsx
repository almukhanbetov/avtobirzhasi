"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function PhoneReveal({ phone }: { phone: string }) {
  const { t } = useLanguage();
  const [revealed, setRevealed] = useState(false);

  if (revealed) {
    return (
      <a
        href={`tel:${phone.replace(/\s/g, "")}`}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand-dark"
      >
        <Phone size={17} />
        {phone}
      </a>
    );
  }

  return (
    <Button
      type="button"
      size="lg"
      className="w-full"
      onClick={() => setRevealed(true)}
    >
      <Phone size={17} />
      {t("phone.reveal")}
    </Button>
  );
}
