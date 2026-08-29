import type { Metadata } from "next";
import { BuyingWays } from "@/components/home/BuyingWays";
import { BuyHowToSteps } from "@/components/buy/BuyHowToSteps";
import { BuyQrDeposit } from "@/components/buy/BuyQrDeposit";

export const metadata: Metadata = {
  title: "Купить автомобиль — AVTOBIRZHASI.KZ",
  description:
    "Два способа купить автомобиль: сразу по текущей цене с депозитом 1% по QR, или через Автобиржу с автоматическим подбором цены.",
};

// /buy reuses the existing two-cards section (BuyingWays — also on the
// homepage) and adds the manual direct-purchase guide + QR deposit block
// below it. The right "Купить через Автобиржу" card is unchanged.
export default function BuyPage() {
  return (
    <>
      <BuyingWays />
      <BuyHowToSteps />
      <BuyQrDeposit />
    </>
  );
}
