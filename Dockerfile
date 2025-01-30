FROM node:lts-alpine

WORKDIR /app

COPY package*.json ./
COPY server/package*.json server/
COPY client/package*.json client/yarn.lock client/

RUN npm run install-client --omit=dev
RUN npm run install-server --omit-dev

COPY client/ client/
RUN yarn --cwd client build

COPY server/ server/
RUN npm run build-server

USER node

CMD [ "npm", "start", "--prefix", "server" ]

EXPOSE 4000