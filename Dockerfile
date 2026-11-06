FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
# the share-preview renderer and emoji art; nothing else
RUN npm ci --omit=dev
# README.md: the completeness test checks every game is listed there
COPY server.js llm.js og.js README.md ./
COPY public ./public
COPY test ./test
# Build fails if the unit tests fail
RUN npm test
USER node
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
