# Skill: Catalog and Car Cards — avtobirzhasi.kz

## Goal
Build a modern, image-first vehicle catalog that works well on large desktop screens and remains usable on mobile.

## Catalog desktop layout
Recommended:
- left sidebar: 280–320px;
- content area: flexible;
- 3 cards per row on 1440px;
- 4 cards per row on wide screens if card width remains comfortable.

Do not make cards too narrow.

## Top bar
Show:
- result count;
- active filter chips;
- sorting;
- view mode only if truly needed.

Example:
"256 автомобилей"

Sort options:
- Сначала новые
- Цена по возрастанию
- Цена по убыванию
- Год новее

## Filter sidebar
Primary filters:
- Регион
- Марка
- Модель
- Цена от / до
- Год от / до
- Кузов
- Коробка
- Привод
- Тип топлива

Do not render 20 controls open by default.
Use collapsible groups for secondary filters.

Mobile:
- hide sidebar;
- open filters in full-height Sheet/Drawer.

## Car card anatomy
1. Image
2. Favorite button
3. Optional badge
4. Make + model
5. Year / mileage / engine / transmission
6. Region
7. Main price
8. Price movement only if Auto Exchange applies

## Car card visual rules
- ratio around 4:3 or 16:10;
- image should occupy roughly 55–65% of visual card height;
- card background white;
- thin neutral border;
- subtle hover;
- no large dramatic shadow;
- radius 14–18px.

## Auto Exchange car card
If seller listing:
- show current price;
- show small downward indicator;
- label: "Цена снижается 1% в сутки".

If buyer request:
- show current offer;
- show upward indicator;
- label: "Цена растёт 1% в сутки".

Do not show fake "96% Match" unless backend actually provides a meaningful score.

## Price typography
Price should be one of the strongest text elements in the card.

Example:
17 850 000 ₸

Secondary movement:
−178 500 ₸ за сутки

Use semantic colors carefully.
Do not make the entire card red/green.

## Loading
Use skeleton cards matching final layout.
Do not use a spinner for the whole catalog when card skeletons are possible.

## Empty state
Explain:
"По выбранным параметрам автомобилей пока нет."

Provide:
- Сбросить фильтры
- Создать заявку покупателя

## URL state
Filters should be reflected in URL search params when practical, e.g.:
?region=almaty&brand=toyota&model=camry&yearFrom=2020

This makes catalog pages shareable and browser-friendly.
