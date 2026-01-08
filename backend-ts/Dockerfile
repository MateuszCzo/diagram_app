FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY src/ ./src/
COPY .env.example .env
COPY tsconfig.json tsconfig.json

RUN npm run build

EXPOSE 8000

CMD ["npm", "start"]