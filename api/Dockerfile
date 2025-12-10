# Gebruik stabiele Node 18 runtime
FROM node:18-slim

# Zet werkdirectory
WORKDIR /app

# Kopieer alleen de API package bestanden
COPY api/package*.json ./

# Installeer dependencies
RUN npm install --omit=dev

# Kopieer enkel de API source code
COPY api ./

# Zorg dat Express luistert op alle interfaces
ENV HOST=0.0.0.0
ENV PORT=8080

# Start server
CMD ["npm", "start"]
