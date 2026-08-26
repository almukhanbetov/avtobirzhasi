"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildHref, type RawSearchParams } from "@/lib/url/searchParams";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

type PageEntry = number | "gap";

function getPageWindow(current: number, total: number): PageEntry[] {
  const numbers = new Set<number>([1, total]);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p > 1 && p < total) numbers.add(p);
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const result: PageEntry[] = [];
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) result.push("gap");
    result.push(p);
  });
  return result;
}

function PageLink({
  href,
  active,
  disabled,
  children,
  ...rest
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (disabled) {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground/40">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg text-[15px] font-medium transition-colors",
        active
          ? "bg-brand text-white"
          : "text-foreground hover:bg-black/[0.04]",
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function Pagination({
  page,
  totalPages,
  pathname,
  searchParams,
}: {
  page: number;
  totalPages: number;
  pathname: string;
  searchParams: RawSearchParams;
}) {
  const { t } = useLanguage();

  if (totalPages <= 1) return null;

  const pages = getPageWindow(page, totalPages);

  return (
    <nav
      aria-label={t("pagination.ariaLabel")}
      className="flex items-center justify-center gap-1.5"
    >
      <PageLink
        href={buildHref(pathname, searchParams, { page: page - 1 })}
        disabled={page <= 1}
        aria-label={t("pagination.prev")}
      >
        <ChevronLeft size={18} />
      </PageLink>

      {pages.map((entry, index) =>
        entry === "gap" ? (
          <span
            key={`gap-${index}`}
            className="flex h-10 w-6 items-center justify-center text-muted-foreground"
          >
            …
          </span>
        ) : (
          <PageLink
            key={entry}
            href={buildHref(pathname, searchParams, { page: entry })}
            active={entry === page}
          >
            {entry}
          </PageLink>
        ),
      )}

      <PageLink
        href={buildHref(pathname, searchParams, { page: page + 1 })}
        disabled={page >= totalPages}
        aria-label={t("pagination.next")}
      >
        <ChevronRight size={18} />
      </PageLink>
    </nav>
  );
}
