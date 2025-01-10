# Build frontend
FROM node:18 as frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build backend
FROM python:3.10-slim
WORKDIR /app

# Install nginx
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/build /app/frontend

# Expose default port (will be overridden by Cloud Run's PORT env var)
EXPOSE 8080

# Start both nginx and uvicorn using a shell script
COPY start.sh .
RUN chmod +x start.sh
CMD ["./start.sh"]
