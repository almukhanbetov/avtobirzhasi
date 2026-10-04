import { describe, expect, it } from "vitest";
import { translations } from "./translations";
import { matchStatusLabels, notificationLabels } from "@/lib/labels/dashboard";

// The Match fee is a 0.1% «комиссия», not a 1% «депозит». The ±1% daily
// price movement is a separate rule and must keep saying 1%.
const DAILY_RATE_CONTEXT = /в сутки|в день|тәулігіне|күніне|[−+±-]1%/;

function allStrings(): [string, string][] {
  const out: [string, string][] = [];
  for (const [lang, dict] of Object.entries(translations)) {
    for (const [key, value] of Object.entries(dict)) out.push([`${lang}.${key}`, value]);
  }
  for (const [lang, dict] of Object.entries(matchStatusLabels)) {
    for (const [key, value] of Object.entries(dict)) out.push([`matchStatus.${lang}.${key}`, value]);
  }
  for (const [lang, dict] of Object.entries(notificationLabels)) {
    for (const [key, value] of Object.entries(dict)) out.push([`notification.${lang}.${key}`, value]);
  }
  return out;
}

describe("commission terminology (RU/KZ)", () => {
  it("never shows the word «депозит» to users", () => {
    const offenders = allStrings().filter(([, v]) => /депозит/i.test(v));
    expect(offenders).toEqual([]);
  });

  it("never mentions 1% outside the daily price-movement rule", () => {
    const offenders = allStrings().filter(
      ([, v]) => /(^|[^,.\d])1\s?%/.test(v) && !DAILY_RATE_CONTEXT.test(v),
    );
    expect(offenders).toEqual([]);
  });

  it("states the commission as 0,1%", () => {
    expect(translations.ru["home.buyingWays.way1.point2"]).toBe(
      "Комиссия — 0,1% от стоимости автомобиля",
    );
    expect(translations.ru["buy.qr.text"]).toBe("Оплатите комиссию 0,1% от текущей цены по QR");
    expect(translations.ru["home.buyingWays.way2.point3"]).toBe(
      "Контакты открываются после оплаты комиссии",
    );
    expect(translations.ru["exchange.steps.step4.title"]).toBe("Комиссия 0,1%");
    expect(translations.kz["exchange.steps.step4.title"]).toBe("0,1% комиссия");
  });

  it("keeps the daily ±1% price movement texts unchanged", () => {
    expect(translations.ru["exchange.diagram.seller"]).toBe("Продавец: −1% в сутки");
    expect(translations.ru["exchange.diagram.buyer"]).toBe("Покупатель: +1% в сутки");
  });
});
