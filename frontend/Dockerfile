FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache nano

COPY package.json package-lock.json ./
RUN npm install

COPY public/ ./public/
COPY src/ ./src/
COPY .env.example .env
COPY eslint.config.js .
COPY index.html .
COPY tsconfig.app.json .
COPY tsconfig.json .
COPY tsconfig.node.json .
COPY vite.config.ts .

EXPOSE 5173

CMD ["npm", "run", "dev"]