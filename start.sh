#!/bin/bash

# Start the FastAPI backend
cd /app/backend
uvicorn main:app --host 127.0.0.1 --port 8000 &

# Replace PORT in nginx.conf
sed -i "s/\$PORT/${PORT:-8080}/g" /etc/nginx/nginx.conf

# Start nginx
nginx -g 'daemon off;' 