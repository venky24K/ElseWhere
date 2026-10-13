# Multi-Stage Production Dockerfile for ElseWhere (Latexer)
# Compiles React SPA (client) and TypeScript Express backend (server)
# Includes TeXLive (pdflatex, latexmk) & Tectonic for on-the-fly compilation

# -------------------------------------------------------------
# Stage 1: Build Client (Vite + React SPA)
# -------------------------------------------------------------
FROM node:20-bookworm-slim AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm install

COPY client ./
RUN npm run build

# -------------------------------------------------------------
# Stage 2: Build Server (Express + TypeScript)
# -------------------------------------------------------------
FROM node:20-bookworm-slim AS server-builder
WORKDIR /app/server

COPY server/package*.json ./
RUN npm install

COPY server ./
RUN npm run build

# -------------------------------------------------------------
# Stage 3: Production Runtime
# -------------------------------------------------------------
FROM node:20-bookworm-slim AS runner

# Install ca-certificates, curl, fontconfig, TeX Live (pdflatex, latexmk, extra packages)
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    fontconfig \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    latexmk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install server production dependencies only
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Copy built server & client assets
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=client-builder /app/client/dist ./client/dist

# Cloud Run defaults: port 8080
ENV NODE_ENV=production
ENV CLIENT_DIST_PATH=/app/client/dist
ENV PORT=8080
EXPOSE 8080

WORKDIR /app/server
CMD ["node", "dist/index.js"]
