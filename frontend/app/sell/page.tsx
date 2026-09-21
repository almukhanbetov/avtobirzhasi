import type { Metadata } from "next";
import { SellHero } from "@/components/sell/SellHero";
import { SellSteps } from "@/components/sell/SellSteps";

export const metadata: Metadata = {
  title: "Продать автомобиль через Автобиржу — AVTOBIRZHASI.KZ",
  description:
    "Укажите автомобиль и желаемую цену. Автобиржа автоматически поможет найти покупателя, когда ваши ценовые предложения сблизятся.",
};

// Stage 9Б-21: the "Продать" nav item's landing page — informational
// only, not a second listing form. The CTA hands off to the existing
// /sell/new (ListingForm, already RequireAuth-gated); nothing here
// duplicates that form or its validation.
export default function SellPage() {
  return (
    <>
      <SellHero />
      <SellSteps />
    </>
  );
}
