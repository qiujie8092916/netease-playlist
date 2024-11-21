FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY . .

RUN npm ci


FROM node:20-alpine AS RUNTIME

WORKDIR /usr/src/app

COPY --from=build /usr/src/app .

CMD ["./index.js"]