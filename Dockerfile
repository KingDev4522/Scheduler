# syntax=docker/dockerfile:1
FROM node:22-alpine AS web
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATABASE_PATH=/data/state.sqlite3 \
    CORS_ORIGINS=http://localhost:8000 \
    ALLOW_DEMO_HEADER=0
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend backend
COPY solver solver
COPY CrunchWeek_StarterPack CrunchWeek_StarterPack
COPY --from=web /web/dist dist
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=5 \
    CMD curl -fsS http://127.0.0.1:8000/api/health || exit 1
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
