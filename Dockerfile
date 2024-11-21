FROM node:20

WORKDIR /usr/src/app

COPY . .

RUN npm ci

ENV CRON=''

CMD ["node", "./index.js"]