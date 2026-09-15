# syntax=docker/dockerfile:1

# ---- Build stage: install deps and produce static assets ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Web stage: pure static serving via nginx ----
FROM nginx:1.27-alpine AS web
# The official nginx image runs envsubst on files in this directory at startup.
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:80/ >/dev/null 2>&1 || exit 1

# ---- Verify stage: one-shot Vitest + Playwright run ----
# Playwright's official image ships Chromium and its system dependencies.
FROM mcr.microsoft.com/playwright:v1.63.0-noble AS verify
WORKDIR /app
ENV CI=true
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Build once more inside the image (npm run verify = build + vitest + playwright).
CMD ["npm", "run", "verify"]
