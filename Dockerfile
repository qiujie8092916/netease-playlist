FROM node:18-slim AS build

RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && apt-get update && \
    apt-get install -y python3 python3-pip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci


FROM arm64v8/node:18-slim AS RUNTIME

RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && apt-get update && \
    apt-get install -y python3 python3-pip && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY --from=build /usr/src/app .
COPY ./index.js .
CMD ["node", "./index.js"]


FROM node:18-slim AS RUNTIME

RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && apt-get update && \
    apt-get install -y python3 python3-pip && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY --from=build /usr/src/app .
COPY ./index.js .
CMD ["node", "./index.js"]