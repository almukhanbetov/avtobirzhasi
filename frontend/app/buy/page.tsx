import type { Metadata } from "next";
import { BuyingWays } from "@/components/home/BuyingWays";
import { BuyHowToSteps } from "@/components/buy/BuyHowToSteps";

export const metadata: Metadata = {
  title: "Купить автомобиль — AVTOBIRZHASI.KZ",
  description:
    "Два способа купить автомобиль: сразу по текущей цене с депозитом 1% по QR, или через Автобиржу с автоматическим подбором цены.",
};

// /buy reuses the two-cards section (BuyingWays — also on the homepage);
// `withQrDeposit` puts the Halyk QR payment area inside the left "Купить
// сейчас по текущей цене" card. Below it, BuyHowToSteps explains the flow.
// The right "Купить через Автобиржу" card is unchanged.
export default function BuyPage() {
  return (
    <>
      <BuyingWays withQrDeposit />
      <BuyHowToSteps />
    </>
  );
}
