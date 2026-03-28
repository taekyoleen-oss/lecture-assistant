FROM node:20-slim

# LibreOffice headless (PPT → PDF 변환용)
RUN apt-get update && apt-get install -y \
    libreoffice \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 의존성 먼저 (레이어 캐시 활용)
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY lecture-annotation-tool/ ./public/

EXPOSE 3000
CMD ["node", "server.js"]
