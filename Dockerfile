# ╔══════════════════════════════════════════════════════════════╗
# ║  SellClin — Production Dockerfile (Multi-Stage)             ║
# ║  Frontend: React/Vite (Nginx) + Backend: Express/Node      ║
# ╚══════════════════════════════════════════════════════════════╝

# ═══ STAGE 1: Build Frontend + Compile Backend ═══
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --legacy-peer-deps && npx prisma generate

COPY . .

# Variáveis embutidas no bundle do frontend (build-time)
ARG VITE_API_URL=/api
ARG VITE_GOOGLE_CLIENT_ID
ARG GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID:-$GOOGLE_CLIENT_ID}

# Build do frontend (React/Vite → dist/)
RUN npm run typecheck && npx vite build

# Compilar backend TypeScript → JavaScript (server/ → dist-server/)
RUN npx tsc -p tsconfig.server.json --outDir dist-server


# ═══ STAGE 2: Production Dependencies ═══
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Apenas dependências de produção + Prisma client
RUN npm ci --omit=dev --ignore-scripts --legacy-peer-deps && npx prisma@6.18.0 generate


# ═══ STAGE 3: Production Runtime ═══
FROM node:20-alpine AS production
WORKDIR /app

# Nginx + su-exec (para rodar Node como user node)
RUN apk add --no-cache nginx su-exec ffmpeg && \
    mkdir -p /run/nginx /app/uploads && \
    chown -R nginx:nginx /run/nginx /var/lib/nginx /var/log/nginx && \
    chown -R node:node /app/uploads

# Dependências de produção (com Prisma client)
COPY --from=deps /app/node_modules ./node_modules

# Backend compilado (JavaScript puro — sem tsx)
COPY --from=builder /app/dist-server ./dist-server

# Prisma schema (necessário pelo Prisma client em runtime)
COPY --from=deps /app/prisma ./prisma

# package.json (necessário para ESM "type": "module")
COPY package.json ./

# Frontend build (HTML/JS/CSS estáticos)
COPY --from=builder /app/dist ./dist

# Configs de runtime
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=4000

# Nginx escuta na porta 80 (Traefik conecta aqui)
EXPOSE 80

# Healthcheck: verifica se Nginx + API estão respondendo
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1/api/health || exit 1

# Container inicia como root (necessário para Nginx na porta 80),
# mas o Node.js roda como user "node" via su-exec no entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
