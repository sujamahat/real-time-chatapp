FROM node:20-alpine AS base
WORKDIR /app

COPY package.json ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/server ./apps/server

RUN npm install
WORKDIR /app/apps/server
RUN npx prisma generate
RUN npm run build

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
