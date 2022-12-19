# syntax=docker/dockerfile:1

# ---- Builder ----
FROM --platform=$BUILDPLATFORM node:19-alpine3.16 AS builder

RUN mkdir /build
WORKDIR /build

COPY package.json .
COPY pnpm-lock.yaml .

RUN apk add --update --no-cache git
RUN npm install -g pnpm@7

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run generate
RUN pnpm run build

# ---- Dependencies ----
FROM --platform=$BUILDPLATFORM node:19-alpine3.16 AS deps

WORKDIR /deps

COPY package.json .
COPY pnpm-lock.yaml .
COPY ./prisma .

RUN apk add --update --no-cache git
RUN npm install -g pnpm@7

RUN pnpm install --frozen-lockfile --prod --no-optional
RUN pnpm dlx prisma generate

# ---- Runner ----
FROM --platform=$BUILDPLATFORM node:19-alpine3.16

RUN apk add --update --no-cache dumb-init git
RUN npm install -g pnpm@7

WORKDIR /app

COPY --from=builder /build/package.json ./package.json
COPY --from=builder /build/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /build/slash-up.config.js ./slash-up.config.js
COPY --from=deps /deps/node_modules ./node_modules
COPY --from=builder /build/prisma ./prisma
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/locale ./locale

USER node
EXPOSE 8020
ENV SERVER_HOST=0.0.0.0

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "pnpm run migrate && pnpm run start"]
