# Backend - Node.js + Express
FROM node:18-alpine

WORKDIR /app/backend

# Copiar package.json y instalar dependencias
COPY backend/package*.json ./
RUN npm ci --only=production

# Copiar código
COPY backend/src ./src
COPY backend/public ./public

# Exponer puerto
EXPOSE 3001

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3001

# Comando de inicio
CMD ["node", "src/index.js"]
