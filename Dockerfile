FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=8080 \
    REELRELAY_DATA_DIR=/data

RUN apk add --no-cache su-exec \
    && mkdir -p /data \
    && chown node:node /data
COPY --from=builder --chown=node:node /app/.output ./.output
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
