FROM node:16-slim AS build

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci

FROM node:16-slim AS RUNTIME

WORKDIR /usr/src/app

COPY --from=build /usr/src/app .
COPY ./index.js .
COPY ./docker-entrypoint.sh .

RUN chmod +x ./index.js
RUN chmod +x ./docker-entrypoint.sh

CMD ["sh", "-c", "./docker-entrypoint.sh"]