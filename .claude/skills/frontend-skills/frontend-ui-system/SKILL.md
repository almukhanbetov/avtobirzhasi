# Skill: Frontend UI System — avtobirzhasi.kz

## Purpose
Build a premium, wide-screen, modern automotive marketplace UI for avtobirzhasi.kz using Next.js + TypeScript + Tailwind CSS.

The product is not just a classifieds site. It combines:
1. Standard car listings.
2. Buyer requests.
3. An automated auto-exchange where seller and buyer prices move toward each other until a Match is created.

## Design direction
Use the visual cleanliness and confidence of premium automotive marketplaces such as AvailableCar as inspiration, but DO NOT copy layouts, branding, text, colors, or components directly.

The UI must feel:
- premium;
- spacious;
- modern;
- trustworthy;
- simple;
- fast;
- automotive;
- slightly technological because of the Auto Exchange feature.

Avoid:
- cramped layouts;
- tiny content width;
- excessive gradients;
- glassmorphism everywhere;
- neon cyberpunk styling;
- too many colors;
- huge rounded corners;
- random shadows;
- excessive animation;
- generic SaaS-dashboard appearance.

## Layout
Desktop-first wide-screen layout.

Recommended main container:
- max-width: 1520–1600px;
- horizontal padding: 24–40px;
- centered;
- full-width sections may use edge-to-edge backgrounds.

Breakpoints:
- mobile: 360–767px;
- tablet: 768–1199px;
- desktop: 1200–1599px;
- wide desktop: 1600px+.

The desktop version must use available horizontal space effectively.

## Visual language
Base palette:
- background: #F7F8FA
- surface: #FFFFFF
- main text: #111827
- secondary text: #667085
- border: #E5E7EB
- success: use restrained green
- warning: use restrained amber
- destructive: use restrained red

Use ONE primary brand accent color consistently for:
- main CTA;
- selected states;
- key Auto Exchange elements;
- Match state;
- active navigation.

Do not introduce extra accent colors without a clear semantic reason.

## Typography
Use a modern sans-serif font.
Examples: Inter, Geist, Manrope.

Rules:
- strong hierarchy;
- large hero heading;
- compact but readable card typography;
- avoid excessive font weights;
- avoid uppercase everywhere.

Recommended:
- H1: 52–72px desktop;
- H2: 32–44px;
- H3: 22–28px;
- body: 16–18px;
- metadata: 13–15px.

## Radius and shadows
- cards: 14–18px radius;
- buttons: 10–14px radius;
- inputs: 10–12px radius;
- chips: pill only when appropriate.

Shadows:
- very subtle;
- prefer borders over heavy shadows;
- no floating-card look on every element.

## Spacing
Use generous vertical rhythm:
- section spacing: 72–120px desktop;
- internal card spacing: 18–28px;
- grid gaps: 20–28px.

## Header
Header should be clean and wide.

Desktop navigation:
- logo;
- Автомобили;
- Купить;
- Продать;
- Автобиржа;
- Как это работает;
- favorites icon;
- login/profile;
- primary CTA: Подать объявление.

Header should not feel overcrowded.

## Buttons
Primary:
- strong solid brand color;
- high contrast;
- clear label.

Secondary:
- white or neutral surface;
- thin border.

Avoid more than 2 major CTA styles per section.

## Icons
Use Lucide Icons or equivalent.
Do not use emojis as production icons.

## Images
Car photography is the visual hero.
Always preserve image ratio.
Use object-fit: cover.
Avoid aggressive cropping of cars.
Cards should prioritize the vehicle photo.

## Accessibility
- strong color contrast;
- visible keyboard focus;
- semantic labels;
- buttons must look clickable;
- do not rely on color alone for status;
- alt text for car images.

## Frontend stack
Preferred:
- Next.js App Router;
- TypeScript;
- Tailwind CSS;
- shadcn/ui only as a base, not as a visual identity;
- Lucide;
- TanStack Query for API state.

## Component rules
Create reusable components:
- Container
- SectionHeader
- Button
- Input
- Select
- Badge
- CarCard
- PriceMovement
- MatchIndicator
- EmptyState
- Skeleton
- Pagination
- FilterSidebar
- MobileFilterSheet

Avoid giant page.tsx files.

## Quality gate
Before finishing any page, verify:
1. Does it look premium at 1440px and 1920px?
2. Is the content too narrow?
3. Is the car image visually dominant?
4. Is there a clear primary action?
5. Are colors restrained?
6. Are spacing and typography consistent?
7. Does Auto Exchange look like a core feature rather than an afterthought?
8. Does mobile remain usable without copying desktop literally?
