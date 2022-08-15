# syntax=docker/dockerfile:1

# This builds the server
FROM node:18-alpine AS builder

RUN mkdir /build
WORKDIR /build

COPY package.json .
COPY yarn.lock .
RUN yarn install --immutable

COPY . .
RUN yarn generate
RUN yarn build

# ---- Dependencies ----
FROM node:18-alpine AS deps

WORKDIR /deps

COPY package.json .
COPY yarn.lock .
COPY ./prisma .
RUN yarn install --frozen-lockfile --prod --ignore-optional
RUN yarn generate

# ---- Runner ----
FROM node:18-alpine

RUN apk add dumb-init

WORKDIR /app

COPY --from=builder /build/package.json ./package.json
COPY --from=builder /build/yarn.lock ./yarn.lock
COPY --from=builder /build/slash-up.config.js ./slash-up.config.js
COPY --from=deps /deps/node_modules ./node_modules
COPY --from=builder /build/prisma ./prisma
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/locale ./locale

USER node
EXPOSE 8020
ENV SERVER_HOST=0.0.0.0

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "yarn migrate && yarn start"]
