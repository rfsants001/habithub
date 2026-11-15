FROM node:24-bookworm-slim AS web-build
WORKDIR /build
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /build/dist/ /usr/share/nginx/html/
EXPOSE 8080

FROM node:24-bookworm-slim AS api-deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production SERVER_HOST=0.0.0.0 PORT=3000 DB_FILE=/data/habithub.db
RUN mkdir -p /data && chown node:node /data
COPY --from=api-deps /build/node_modules ./node_modules
COPY api/package.json ./
COPY api/src ./src
USER node
EXPOSE 3000
CMD ["./node_modules/.bin/tsx", "src/server.ts"]
