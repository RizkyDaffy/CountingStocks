# Google Sheets microservice for the BCP (/backup) feature.
# Built and pushed by release.yml as ghcr.io/<owner>/counting-stock-gsheet:<tag>.

FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 4002

CMD ["node", "dist/main.js"]
