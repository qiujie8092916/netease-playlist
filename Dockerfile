FROM node:16-slim AS build

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci

FROM arm64v8/node:16-slim AS RUNTIME
WORKDIR /usr/src/app
COPY --from=build /usr/src/app .
COPY ./index.js .
CMD ["node", "./index.js"]

FROM node:16-slim AS RUNTIME
WORKDIR /usr/src/app
COPY --from=build /usr/src/app .
COPY ./index.js .
CMD ["node", "./index.js"]