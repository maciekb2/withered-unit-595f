ARG NODE_IMAGE=node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5
ARG CA_IMAGE=curlimages/curl:8.16.0@sha256:463eaf6072688fe96ac64fa623fe73e1dbe25d8ad6c34404a669ad3ce1f104b6

FROM ${CA_IMAGE} AS ca-bootstrap
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:node && npm prune --omit=dev

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=ca-bootstrap /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \
 && apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Flux source extraction can leave public assets readable only by root.
# Assign ownership while copying, so USER node can read even mode 0600 files.
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build --chmod=0644 /app/scripts/selfhosted-scheduler.mjs ./scripts/selfhosted-scheduler.mjs
COPY --from=build --chmod=0644 /app/scripts/selfhosted-scheduler-lib.mjs ./scripts/selfhosted-scheduler-lib.mjs
COPY --from=build --chmod=0644 /app/scripts/social-worker.mjs ./scripts/social-worker.mjs
COPY --from=build --chmod=0644 /app/scripts/social-weekly-client.mjs ./scripts/social-weekly-client.mjs
COPY --from=build --chmod=0644 /app/scripts/social-metrics-sync.mjs ./scripts/social-metrics-sync.mjs
COPY --from=build --chmod=0644 /app/scripts/social-buffer-state.mjs ./scripts/social-buffer-state.mjs
COPY --from=build --chmod=0644 /app/scripts/social-copy.mjs ./scripts/social-copy.mjs
COPY --from=build --chmod=0644 /app/scripts/social-outro.mjs ./scripts/social-outro.mjs
COPY --from=build --chmod=0644 /app/scripts/social-motion.mjs ./scripts/social-motion.mjs
COPY --from=build --chmod=0644 /app/scripts/social-carousel.mjs ./scripts/social-carousel.mjs
COPY --from=build --chmod=0644 /app/scripts/social-buffer-assets.mjs ./scripts/social-buffer-assets.mjs
RUN chmod 0755 /app /app/scripts
# Build tools are not used by the standalone Node runtime. Removing every
# bundled esbuild copy avoids shipping its Go executable and its Go stdlib.
RUN find /app/node_modules -type d \( -name esbuild -o -name @esbuild \) -prune -exec rm -rf '{}' + \
 && rm -rf /usr/local/lib/node_modules/npm \
 && rm /usr/local/bin/npm /usr/local/bin/npx
USER node
RUN for script in /app/scripts/*.mjs; do test -r "$script"; done
RUN node --input-type=module -e 'import fs from "node:fs"; for (const file of fs.readdirSync("/app/dist/client", {recursive: true})) fs.accessSync("/app/dist/client/" + file, fs.constants.R_OK)'
EXPOSE 3000
CMD ["node", "./dist/server/entry.mjs"]
