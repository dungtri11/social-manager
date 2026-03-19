FROM node:20-slim

WORKDIR /app

# Install backend dependencies first for better layer caching.
COPY package*.json ./
RUN npm install

# Install Playwright browser binaries and required Linux packages.
RUN npx playwright install --with-deps chromium

# Install UI dependencies.
COPY ui/package*.json ./ui/
RUN cd ui && npm install

# Copy the full project.
COPY . .

EXPOSE 3000 5173

CMD ["bash", "-lc", "npm run dev & API_PID=$!; npm run worker & WORKER_PID=$!; cd ui; npm run dev -- --host 0.0.0.0 --port 5173 & UI_PID=$!; wait -n $API_PID $WORKER_PID $UI_PID; EXIT_CODE=$?; kill $API_PID $WORKER_PID $UI_PID 2>/dev/null || true; wait || true; exit $EXIT_CODE"]