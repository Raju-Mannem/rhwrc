# Multi-stage production build for Gridbricks Frontend

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package.json package-lock.json ./

# Install dependencies deterministically
RUN npm ci

# Copy application source
COPY . .

# Run production build
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine

# Copy custom Nginx configuration with SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
