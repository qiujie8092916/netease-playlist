FROM node:16-alpine AS build

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci

FROM node:16-alpine AS RUNTIME

WORKDIR /usr/src/app

COPY --from=build /usr/src/app .
COPY ./index.js .

RUN chmod +x ./index.js

CMD ["node", "index.js"]