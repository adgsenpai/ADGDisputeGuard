# Multi-stage build for the DisputeGuard web app (Next.js standalone output).
# Build context is the repository ROOT (see infra/docker-compose.yml).

FROM node:22-alpine AS base
WORKDIR /app

# --- Dependencies ----------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci

# --- Build -----------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace @disputeguard/web

# --- Runtime ---------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Ollama is reached over the compose network by default.
ENV OLLAMA_BASE_URL=http://ollama:11434

# Next.js standalone output: server + traced node_modules, plus static assets.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
