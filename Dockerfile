# Build the site, then run the Astro node standalone server.
# The data directory is mounted from the host; nothing in here survives a
# `docker rm`, and nothing here is allowed to hold the subscriber list.

FROM node:26-alpine AS build
WORKDIR /app

# Baked into the prerendered HTML. A build without these produces pages whose
# canonical URL is localhost and whose robots meta is noindex.
ARG SITE_URL=http://localhost:4321
ARG SITE_INDEXABLE=
# Empty means no visit counter: nothing is injected without both.
ARG UMAMI_SCRIPT_URL=
ARG UMAMI_WEBSITE_ID=
ENV SITE_URL=$SITE_URL \
	SITE_INDEXABLE=$SITE_INDEXABLE \
	UMAMI_SCRIPT_URL=$UMAMI_SCRIPT_URL \
	UMAMI_WEBSITE_ID=$UMAMI_WEBSITE_ID

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

FROM node:26-alpine AS runtime
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
# The jobs that run in this image need exactly these source files: config and
# list for the purge; bounces for the bounce sweep; i18n, list, mail, newsletter
# and videos for the weekly mail. A missing one here is a job that fails at
# 04:17 with ERR_MODULE_NOT_FOUND, which is why a test checks this list against
# the scripts' imports.
COPY --from=build /app/src/lib/config.ts /app/src/lib/list.ts \
	/app/src/lib/bounces.ts /app/src/lib/i18n.ts /app/src/lib/mail.ts \
	/app/src/lib/newsletter.ts /app/src/lib/videos.ts ./src/lib/

# `node` is uid 1000. The mounted /data must be owned by that uid (see README).
USER node
EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
