FROM node:20-alpine AS build
WORKDIR /front
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ ./
COPY --from=build /front/dist/encuestas-lab/browser ./public
EXPOSE 8080
CMD ["node","server.js"]
