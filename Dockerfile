FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

HEALTHCHECK --interval=5s --timeout=4s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health', {signal: AbortSignal.timeout(3000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]