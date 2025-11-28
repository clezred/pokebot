FROM node:25-alpine

ENV NODE_ENV production

# Install dependencies for node-canvas
RUN apk add --no-cache \
    build-base \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    python3 \
    ttf-dejavu \
    font-noto \
    font-noto-emoji

WORKDIR /app

COPY package*.json ./ 

RUN npm install

COPY . .

CMD ["node", "."]
