# File: face-attendance-system/api/Dockerfile
# (เวอร์ชันล่าสุด: ใช้ node:18-bullseye-slim, รัน prisma generate ถูกต้อง)

# Use Node.js 18 based on Debian Bullseye (compatible with Prisma's OpenSSL 1.1)
FROM node:18-bullseye-slim

WORKDIR /app

# Copy package files and install dependencies first for caching
COPY package*.json ./
# Use --omit=dev if you have devDependencies you don't need in production
RUN npm install

# Copy the Prisma schema first (needed for generate step)
COPY prisma ./prisma/

# Copy the rest of the application code
COPY . .

# Generate Prisma Client (needs schema.prisma from previous step)
# This will fail if `db pull` hasn't populated the schema locally first,
# OR if the schema file wasn't copied correctly.
RUN npx prisma generate

# Expose the port the app runs on (optional but good practice)
EXPOSE 8000

# Command to run the application
CMD ["npm", "start"]