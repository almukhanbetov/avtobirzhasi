import type { Metadata } from "next";
import { ExchangeExplainer } from "@/components/home/ExchangeExplainer";

export const metadata: Metadata = {
  title: "Как работает Автобиржа — AVTOBIRZHASI.KZ",
  description:
    "Автоматический механизм Автобиржи: цена продавца снижается на 1% в сутки, цена покупателя растёт на 1% в сутки, при сближении примерно до 2% создаётся Match, оба вносят депозит 1%, затем открываются контакты.",
};

// Stage 9Б-20: /how-it-works reuses ExchangeExplainer as-is — the exact
// same "Как работает Автобиржа" section already shown on the homepage
// (same diagram, same four step cards, same icons/numbering), and
// nothing else. BuyingWays was removed from this page per this stage —
// it stays exactly as-is on / and /buy, both untouched.
export default function HowItWorksPage() {
  return <ExchangeExplainer />;
}
