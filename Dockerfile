# Hamac — instance web auto-hébergée. Se lance avec PostgreSQL via docker-compose.yml.

FROM node:24-slim AS build
WORKDIR /src
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @hamac/ui build \
 && pnpm --filter @hamac/server build

FROM node:24-slim
ENV NODE_ENV=production \
    HAMAC_DATA_DIR=/data \
    HAMAC_PORT=8080 \
    HAMAC_SIGNUP=invite
WORKDIR /app
COPY --from=build /src/apps/server/dist ./
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.HAMAC_PORT+'/api/auth/config').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
