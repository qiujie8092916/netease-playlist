FROM node:16-slim AS build

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci

FROM node:16-slim AS RUNTIME

WORKDIR /usr/src/app

COPY --from=build /usr/src/app .
COPY ./index.js .

RUN chmod +x ./index.js

ENTRYPOINT []

CMD ["node", "./index.js"]