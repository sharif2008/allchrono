# AllChrono API — dev/demo image (single stage, keeps dev deps for prisma+ts-node seed).
FROM node:20-alpine AS build

RUN apk add --no-cache openssl
RUN npm install -g pnpm@9

WORKDIR /app

# Workspace manifests first for better layer caching.
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --filter @allchrono/api...

# Source
COPY apps/api apps/api

WORKDIR /app/apps/api
RUN pnpm prisma generate && pnpm build

EXPOSE 3001

# migrate + seed + serve is orchestrated by docker-compose `command`.
CMD ["node", "dist/main.js"]
