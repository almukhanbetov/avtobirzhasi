# syntax=docker/dockerfile:1
# =========================================================
# 1. Dependencies
# =========================================================
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# =========================================================
# 2. Build Next.js
# =========================================================
FROM node:24-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# URL backend API встраивается в frontend во время сборки
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# Гарантируем наличие public,
# даже если папка пустая и Git её не сохранил
RUN mkdir -p public
RUN npm run build
# =========================================================
# 3. Production runner
# =========================================================
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Запускаем Next.js не от root
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Статические файлы из public
COPY --from=builder /app/public ./public

# Next.js standalone production build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Next.js static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]