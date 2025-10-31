FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# รัน React Dev Server
CMD ["npm", "start"]