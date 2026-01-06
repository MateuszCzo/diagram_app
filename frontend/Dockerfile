FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache nano

COPY package.json package-lock.json ./
RUN npm install

COPY public/ ./public/
COPY src/ ./src/
COPY .env.example .env
COPY package-lock.json .
COPY package.json .

EXPOSE 3000

CMD ["npm", "start"]
