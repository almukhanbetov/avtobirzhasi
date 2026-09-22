import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_CONTACT } from "@/lib/contact/adminContact";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// The shared "Показать номер"/"Позвонить" replacement used everywhere the
// site needs a contact affordance that used to show a seller's own
// number (VehiclePriceSidebar, SellerCard) or now shows the same admin
// number once a Match is confirmed (MatchCard) — see ADMIN_CONTACT's own
// doc comment for why this is always the admin's number, never a real
// seller/buyer phone. Plain `<a href="tel:...">`, not next/link (`tel:`
// is not an internal route — BuyingWays.tsx already established this
// convention for the same number before this component existed) and not
// a two-step "reveal" button: the number is shown and dialable
// immediately, same as the task's own reference example. Nothing here
// starts a call on its own — only the user tapping/clicking the link
// does, same as any other `tel:` anchor.
export function AdminContactLink({
  variant = "button",
  className,
}: {
  variant?: "button" | "compact";
  className?: string;
}) {
  const { t } = useLanguage();

  if (variant === "compact") {
    return (
      <a
        href={`tel:${ADMIN_CONTACT.telPhone}`}
        className={cn(
          "inline-flex items-center gap-2 text-[14px] font-semibold text-brand hover:text-brand-dark",
          className,
        )}
      >
        <Phone size={16} className="shrink-0" />
        {ADMIN_CONTACT.displayPhone}
      </a>
    );
  }

  return (
    <a
      href={`tel:${ADMIN_CONTACT.telPhone}`}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-[15px] font-medium text-white transition-colors hover:bg-brand-dark",
        className,
      )}
    >
      <Phone size={17} />
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[12px] font-normal text-white/80">
          {t("contact.adminLabel")}
        </span>
        <span>{ADMIN_CONTACT.displayPhone}</span>
      </span>
    </a>
  );
}
