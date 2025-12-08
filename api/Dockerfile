# Gebruik officiële Node.js runtime
FROM node:18

# Maak app directory
WORKDIR /app

# Kopieer package files
COPY package*.json ./

# Installeer dependencies
RUN npm install --omit=dev

# Kopieer app source code
COPY . .

# Cloud Run verplicht port 8080
ENV PORT=8080

# App starten
CMD ["npm", "start"]
