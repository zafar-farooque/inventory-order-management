# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build
# Uses node:18-alpine to install dependencies and produce the optimised bundle.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for better layer caching.
# The npm install layer is only rebuilt when package*.json changes.
COPY package.json package-lock.json ./

RUN npm ci --silent

# Copy source and build.
# REACT_APP_API_URL can be injected at build time via --build-arg:
#   docker build --build-arg REACT_APP_API_URL=https://api.example.com .
ARG REACT_APP_API_URL=http://localhost:8000
ENV REACT_APP_API_URL=$REACT_APP_API_URL

COPY . .
RUN npm run build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Serve
# Uses nginx:alpine (< 10 MB) to serve the static build folder.
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the React build output from the builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy a custom nginx config that handles React Router's client-side routing.
# Without this, refreshing /products or /orders/:id returns a 404 from nginx.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# nginx runs in the foreground (daemon off is set in the custom config)
CMD ["nginx", "-g", "daemon off;"]
