FROM node:24-bookworm-slim AS dependencies
WORKDIR /workspace
COPY package*.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM dependencies AS build
COPY apps/api apps/api
RUN npm run build -w @sports-booking/api

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies /workspace/node_modules ./node_modules
COPY package.json ./package.json
COPY apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
USER node
CMD ["node", "apps/api/dist/main.js"]
