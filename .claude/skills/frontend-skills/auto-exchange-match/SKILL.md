# Skill: Auto Exchange and Match UI — avtobirzhasi.kz

## Goal
Make Auto Exchange the product's signature feature.

It must look trustworthy, understandable, and premium — not like gambling, trading, or crypto.

## Core business rules to visualize
Seller:
- starting price;
- price decreases 1% per day.

Buyer:
- starting offer;
- offer increases 1% per day.

Matching:
- compare Region, Make, Model, Year, Price;
- when price gap is within configured tolerance around 2%, create Match.

After Match:
- freeze both listings;
- notify both parties;
- each party pays 1% deposit;
- contacts open only after both deposits;
- if deadline passes, Match becomes expired;
- listings become active again;
- handled refunds are shown clearly.

## Auto Exchange landing page
Recommended sections:
1. Hero
2. Price convergence visual
3. How it works in 4–5 steps
4. Example seller vs buyer
5. Deposits and safety
6. CTA

## Price convergence visual
Use two sides:
Seller price -> moves down
Buyer offer -> moves up

Center:
MATCH

Animation may be used, but:
- subtle;
- 300–700ms transitions;
- do not animate endlessly;
- respect prefers-reduced-motion.

## Match status UI
Statuses should be clear:
- Ожидается депозит
- Депозит продавца внесён
- Депозит покупателя внесён
- Сделка подтверждена
- Истёк срок
- Отменено

Do not display raw backend enum values.

## Match page
Show:
- vehicle;
- final agreed price;
- deposit amount;
- both deposit statuses;
- deadline;
- clear next action.

Example layout:

Vehicle summary
Toyota Camry 2022

Final price
17 050 000 ₸

Your deposit
170 500 ₸

Seller deposit: Paid / Waiting
Buyer deposit: Paid / Waiting

Time remaining
23:51:19

Primary CTA
Внести депозит

## Contacts
Before both deposits:
- show locked contact area;
- explain: "Контакты откроются после внесения обоих депозитов."

After confirmation:
- display contact actions clearly.

Never retrieve or embed protected contact info on the frontend before backend authorization allows it.

## Visual semantics
Match state may use brand accent + success styling.
Expired should use neutral/warning styling, not dramatic red screens.

## Important
Avoid language such as:
- ставка;
- выигрыш;
- проигрыш;
- торговая биржа;
- инвестиция.

The feature is an automated buyer/seller matching mechanism, not a speculative marketplace.
