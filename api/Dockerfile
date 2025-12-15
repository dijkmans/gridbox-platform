FROM node:18-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

ENV PORT=8080

CMD ["node", "src/index.js"]
