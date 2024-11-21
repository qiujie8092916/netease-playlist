FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci


FROM node:20-alpine AS RUNTIME

WORKDIR /usr/src/app

COPY --from=build /usr/src/app .
COPY ./index.js .

CMD ["./index.js"]