"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function Gallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const { t } = useLanguage();
  const [active, setActive] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const next = () => setActive((value) => (value + 1) % images.length);
  const prev = () =>
    setActive((value) => (value - 1 + images.length) % images.length);

  useEffect(() => {
    if (!fullscreen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFullscreen(false);
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") prev();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, images.length]);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setFullscreen(true)}
        className="group relative block aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border bg-background"
      >
        <Image
          src={images[active]}
          alt={title}
          fill
          priority
          sizes="(min-width: 1024px) 65vw, 100vw"
          className="object-cover"
        />
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-3 py-1.5 text-[13px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Expand size={14} />
          {active + 1} / {images.length}
        </span>
      </button>

      <div className="grid grid-cols-4 gap-3">
        {images.map((src, index) => (
          <button
            key={`${src}-${index}`}
            type="button"
            onClick={() => setActive(index)}
            aria-label={`${t("gallery.showPhoto")} ${index + 1}`}
            className={cn(
              "relative aspect-[4/3] overflow-hidden rounded-xl border transition-colors",
              index === active
                ? "border-brand"
                : "border-border hover:border-foreground/30",
            )}
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="150px"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {fullscreen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between px-6 py-5">
            <span className="text-[14px] font-medium text-white/70">
              {active + 1} / {images.length}
            </span>
            <button
              type="button"
              aria-label={t("gallery.close")}
              onClick={() => setFullscreen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative flex-1">
            <Image
              src={images[active]}
              alt={title}
              fill
              sizes="100vw"
              className="object-contain"
            />

            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label={t("gallery.prev")}
                  onClick={prev}
                  className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  aria-label={t("gallery.next")}
                  onClick={next}
                  className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
