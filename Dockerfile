# Build the site, then run the Astro node standalone server.
# The data directory is mounted from the host; nothing in here survives a
# `docker rm`, and nothing here is allowed to hold the subscriber list.

FROM node:24-alpine AS build
WORKDIR /app

# Dependencies first, so a source edit does not reinstall them.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=4321 \
	SUBSCRIBERS_DB=/data/subscribers.sqlite

# Astro's node adapter leaves its runtime dependencies external, so the
# production node_modules comes along. The recipe JSON stays on disk because
# src/lib/recipes.ts reads it relative to the working directory.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/recipes ./recipes

# `node` is uid 1000. The mounted /data must be owned by that uid (see README).
USER node
EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
