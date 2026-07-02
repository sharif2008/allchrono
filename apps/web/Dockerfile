# AllChrono Web — Next.js 14 (dev/demo image).
FROM node:20-alpine

RUN npm install -g pnpm@9
WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --filter @allchrono/web...

COPY apps/web apps/web
WORKDIR /app/apps/web

# NEXT_PUBLIC_* is inlined at build time; the browser reaches the API on localhost.
ENV NEXT_PUBLIC_API_URL=http://localhost:3001
RUN pnpm build

EXPOSE 3000
CMD ["pnpm", "start"]
