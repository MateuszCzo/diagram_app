FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache nano

COPY package.json package-lock.json ./
RUN npm install

COPY src/ ./src/
COPY .env.example .env
COPY eslint.config.js .
COPY index.html .
COPY tsconfig.app.json .
COPY tsconfig.json .
COPY tsconfig.node.json .
COPY vite.config.ts .

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
