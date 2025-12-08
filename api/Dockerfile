# Gebruik lichte, stabiele Node 18 runtime
FROM node:18-slim

# Zet werkdirectory
WORKDIR /app

# Kopieer package bestanden eerst (beter caching!)
COPY package*.json ./

# Installeer dependencies, production only
RUN npm install --omit=dev

# Kopieer volledige app
COPY . .

# Cloud Run verplicht poort 8080
ENV PORT=8080

# Zorg dat Express luistert op alle interfaces
ENV HOST=0.0.0.0

# Start app
CMD ["npm", "start"]
