FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src

ENV TZ=America/Argentina/Buenos_Aires

EXPOSE 3001

CMD ["node", "src/index.js"]
