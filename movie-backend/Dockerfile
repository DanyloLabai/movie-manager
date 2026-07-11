FROM node:20-alpine

WORKDIR /app

COPY package.json ./

RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npm run migrate && npm run start:prod"]