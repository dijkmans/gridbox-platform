FROM node:18-slim

WORKDIR /app/api

COPY api/package.json .
COPY api/package-lock.json .
RUN npm install

COPY api .

ENV PORT=8080

CMD ["npm", "start"]
