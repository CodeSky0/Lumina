# syntax=docker/dockerfile:1.7
FROM node:22.14.0-alpine3.21 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:22.14.0-alpine3.21 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    API_INTERNAL_URL=http://api:8080
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json next.config.ts tsconfig.json next-env.d.ts postcss.config.mjs tailwind.config.ts vitest.config.ts vitest.setup.ts ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY stores ./stores
RUN mkdir -p public && \
    node -e "const fs=require('node:fs');const path='next.config.ts';const source=fs.readFileSync(path,'utf8');if(!source.includes('reactStrictMode: true,'))throw new Error('无法启用 standalone');fs.writeFileSync(path,source.replace('reactStrictMode: true,','reactStrictMode: true,\n  output: \"standalone\",'));" && \
    npm run build

FROM node:22.14.0-alpine3.21 AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    API_INTERNAL_URL=http://api:8080
RUN addgroup -g 10001 -S nodejs && \
    adduser -u 10001 -S -D -H -G nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=6 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/login || exit 1
CMD ["node", "server.js"]
