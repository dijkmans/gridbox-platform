FROM node:18-slim

# Werkdirectory binnen de container
WORKDIR /app

# Eerst alleen package-files kopiëren (betere caching)
COPY api/package.json api/package-lock.json ./api/

# Dependencies installeren binnen de api-folder
WORKDIR /app/api
RUN npm install

# Daarna pas de volledige API-code kopiëren
COPY api/ .

# Zorg dat Cloud Run weet op welke poort Node luistert
ENV PORT=8080

# Start de API
CMD ["npm", "start"]
