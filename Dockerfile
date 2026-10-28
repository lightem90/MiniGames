FROM node:22-alpine
WORKDIR /app
COPY package.json server.js llm.js ./
COPY public ./public
COPY test ./test
# Build fails if the unit tests fail
RUN npm test
USER node
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
