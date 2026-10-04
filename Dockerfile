# Builds with STANDALONE_BUILD=1, enabling `output: 'standalone'` in
# next.config.ts. Based on the Next.js with-docker example.

FROM node:22.17.0-alpine AS base

FROM base AS deps
# libc6-compat covers binaries linked against glibc on musl.
# hadolint ignore=DL3018 -- apk package versions churn with the base image
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN \
  if [ -f yarn.lock ]; then STANDALONE_BUILD=1 yarn run build; \
  elif [ -f package-lock.json ]; then STANDALONE_BUILD=1 npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && STANDALONE_BUILD=1 pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Prerender cache permissions
RUN mkdir .next && chown nextjs:nodejs .next

# Standalone output already contains traced node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
