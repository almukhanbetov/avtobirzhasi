"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { formatTenge } from "@/lib/format/money";
import { MatchIndicator } from "@/components/exchange/MatchIndicator";
import { cn } from "@/lib/utils";

const SELLER_START = 15_000_000;
const BUYER_START = 12_500_000;
const DAILY_RATE = 0.01;
const MATCH_TOLERANCE_PERCENT = 2;
const EXTRA_DAYS_AFTER_MATCH = 2;
const MAX_DAYS = 60;

interface DayPoint {
  day: number;
  seller: number;
  buyer: number;
  gapPercent: number;
}

function buildSeries(): { days: DayPoint[]; matchDay: number } {
  const days: DayPoint[] = [];
  let seller = SELLER_START;
  let buyer = BUYER_START;
  let matchDay: number | null = null;
  let frozenSeller = 0;
  let frozenBuyer = 0;

  for (let day = 0; day <= MAX_DAYS; day++) {
    if (matchDay !== null) {
      // Match freezes both listings — prices hold instead of continuing to cross.
      const gapPercent = (Math.abs(frozenSeller - frozenBuyer) / frozenSeller) * 100;
      days.push({ day, seller: frozenSeller, buyer: frozenBuyer, gapPercent });
      if (day >= matchDay + EXTRA_DAYS_AFTER_MATCH) break;
      continue;
    }

    const gapPercent = (Math.abs(seller - buyer) / seller) * 100;
    const roundedSeller = Math.round(seller);
    const roundedBuyer = Math.round(buyer);
    days.push({ day, seller: roundedSeller, buyer: roundedBuyer, gapPercent });

    if (gapPercent <= MATCH_TOLERANCE_PERCENT) {
      matchDay = day;
      frozenSeller = roundedSeller;
      frozenBuyer = roundedBuyer;
    }

    seller *= 1 - DAILY_RATE;
    buyer *= 1 + DAILY_RATE;
  }

  return { days, matchDay: matchDay ?? days.length - 1 };
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const PADDING_X = 12;
const PADDING_Y = 16;

export function ExchangeSimulator() {
  const { days, matchDay } = useMemo(() => buildSeries(), []);
  const [currentDay, setCurrentDay] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || currentDay >= days.length - 1) return;

    const timeout = setTimeout(() => {
      setCurrentDay((day) => {
        const next = day + 1;
        if (next >= days.length - 1) setPlaying(false);
        return next;
      });
    }, 550);

    return () => clearTimeout(timeout);
  }, [playing, currentDay, days.length]);

  const point = days[currentDay];
  const isMatched = currentDay >= matchDay;

  const maxPrice = days[0].seller;
  const minPrice = days[0].buyer;
  const priceRange = maxPrice - minPrice || 1;

  const toX = (day: number) =>
    PADDING_X + (day / (days.length - 1)) * (CHART_WIDTH - PADDING_X * 2);
  const toY = (price: number) =>
    CHART_HEIGHT -
    PADDING_Y -
    ((price - minPrice) / priceRange) * (CHART_HEIGHT - PADDING_Y * 2);

  const sellerPoints = days.map((d) => `${toX(d.day)},${toY(d.seller)}`).join(" ");
  const buyerPoints = days.map((d) => `${toX(d.day)},${toY(d.buyer)}`).join(" ");

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-muted-foreground">
            Цена продавца · день {point.day}
          </span>
          <span className="text-2xl font-semibold tracking-tight text-destructive">
            {formatTenge(point.seller)}
          </span>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <span className="text-[13px] text-muted-foreground">
            Цена покупателя · день {point.day}
          </span>
          <span className="text-2xl font-semibold tracking-tight text-success">
            {formatTenge(point.buyer)}
          </span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-label="Изменение цены продавца и покупателя по дням"
        >
          <polyline
            points={sellerPoints}
            fill="none"
            stroke="var(--destructive)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={buyerPoints}
            fill="none"
            stroke="var(--success)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <line
            x1={toX(currentDay)}
            y1="0"
            x2={toX(currentDay)}
            y2={CHART_HEIGHT}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {isMatched ? (
            <circle
              cx={toX(matchDay)}
              cy={toY(days[matchDay].seller)}
              r="7"
              fill="var(--brand)"
              stroke="white"
              strokeWidth="2"
            />
          ) : null}

          <circle
            className="exchange-dot"
            cx={toX(currentDay)}
            cy={toY(point.seller)}
            r="5"
            fill="var(--destructive)"
          />
          <circle
            className="exchange-dot"
            cx={toX(currentDay)}
            cy={toY(point.buyer)}
            r="5"
            fill="var(--success)"
          />
        </svg>

        {isMatched ? (
          <div className="absolute right-0 top-0">
            <MatchIndicator />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <input
          type="range"
          min={0}
          max={days.length - 1}
          value={currentDay}
          onChange={(event) => {
            setPlaying(false);
            setCurrentDay(Number(event.target.value));
          }}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-brand"
          aria-label="День с момента размещения объявления и заявки"
        />

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              aria-label={playing ? "Остановить" : "Воспроизвести"}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:border-foreground/30"
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setCurrentDay(0);
              }}
              aria-label="Сбросить"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:border-foreground/30"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          <span
            className={cn(
              "text-[14px] font-medium",
              isMatched ? "text-brand-dark" : "text-muted-foreground",
            )}
          >
            {isMatched
              ? "Match: цены сошлись, объявления заморожены"
              : `Разница в цене: ${point.gapPercent.toFixed(1)}%`}
          </span>
        </div>
      </div>
    </div>
  );
}
