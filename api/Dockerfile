FROM node:18-slim

# Werkdirectory binnen de container
WORKDIR /app

# Eerst enkel package.json + lock kopiëren (beste caching)
COPY package.json package-lock.json ./

# Dependencies installeren
RUN npm install

# Daarna volledige API-code kopiëren
COPY . .

# Cloud Run gebruikt deze poort, Node moet dit respecteren
ENV PORT=8080

# Start de API
CMD ["npm", "start"]
