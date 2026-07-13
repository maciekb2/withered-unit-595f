FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:node

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/scripts/selfhosted-scheduler.mjs ./scripts/selfhosted-scheduler.mjs
COPY --from=build /app/scripts/social-worker.mjs ./scripts/social-worker.mjs
COPY --from=build /app/scripts/social-weekly-client.mjs ./scripts/social-weekly-client.mjs
COPY --from=build /app/scripts/social-metrics-sync.mjs ./scripts/social-metrics-sync.mjs
COPY --from=build /app/scripts/social-buffer-state.mjs ./scripts/social-buffer-state.mjs
COPY --from=build /app/scripts/social-copy.mjs ./scripts/social-copy.mjs
COPY --from=build /app/scripts/social-outro.mjs ./scripts/social-outro.mjs
COPY --from=build /app/scripts/social-motion.mjs ./scripts/social-motion.mjs
COPY --from=build /app/scripts/social-carousel.mjs ./scripts/social-carousel.mjs
COPY --from=build /app/scripts/social-buffer-assets.mjs ./scripts/social-buffer-assets.mjs
USER node
EXPOSE 3000
CMD ["node", "./dist/server/entry.mjs"]
