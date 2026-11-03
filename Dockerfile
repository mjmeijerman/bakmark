# Build the site, then run the Astro node standalone server.
# The data directory is mounted from the host; nothing in here survives a
# `docker rm`, and nothing here is allowed to hold the subscriber list.

FROM node:24-alpine AS build
WORKDIR /app

# Dependencies first, so a source edit does not reinstall them.
COPY package.json package-lock.json ./
RUN npm ci

# A second, production-only tree. The build needs vite and astro; the server
# does not, and shipping them puts 178 packages and 151 MB into an image that
# only has to answer HTTP. `--prefix` needs the manifest and lockfile beside it,
# so they are copied there first.
COPY package.json package-lock.json /prod/
RUN cd /prod && npm ci --omit=dev

COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=4321 \
	SUBSCRIBERS_DB=/data/subscribers.sqlite

# Only production dependencies. Astro leaves its runtime deps external, so this
# copy is required; /prod holds exactly those and nothing else.
COPY --from=build /prod/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/recipes ./recipes
# The retention job runs in this image too, and needs exactly two source files.
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/lib/config.ts /app/src/lib/list.ts ./src/lib/

# `node` is uid 1000. The mounted /data must be owned by that uid (see README).
USER node
EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
