# Gebruik lichte, stabiele Node 18 runtime
FROM node:18-slim

# Zet werkdirectory
WORKDIR /app

# Kopieer package bestanden eerst (cache-optimalisatie)
COPY package*.json ./

# Installeer enkel production dependencies
RUN npm install --omit=dev

# Kopieer volledige applicatie
COPY . .

# BELANGRIJK: verwijder deze regel!
# ENV PORT=8080

# Zorg dat Express luistert op alle interfaces
ENV HOST=0.0.0.0

# Start de app
CMD ["npm", "start"]
