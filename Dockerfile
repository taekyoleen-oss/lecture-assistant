FROM node:20-slim

# LibreOffice headless (PPT → PDF 변환용) + 한글 폰트
RUN apt-get update && apt-get install -y \
    libreoffice \
    fonts-noto-cjk \
    fonts-noto-cjk-extra \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# LibreOffice 폰트 캐시 갱신
RUN fc-cache -fv

WORKDIR /app

# 의존성 먼저 (레이어 캐시 활용)
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY lecture-annotation-tool/ ./public/

EXPOSE 3000
CMD ["node", "server.js"]
