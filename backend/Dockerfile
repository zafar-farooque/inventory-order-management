# ─────────────────────────────────────────────────────────────────────────────
# Stage: runtime image
# Base: python:3.11-slim keeps the image small (~150 MB) while still
#       including everything needed to compile psycopg2-binary.
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim

# Prevent Python from buffering stdout/stderr (important for Docker logs)
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Set the working directory inside the container
WORKDIR /app

# ── Install system dependencies needed by psycopg2-binary ────────────────────
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libpq-dev \
        gcc \
    && rm -rf /var/lib/apt/lists/*

# ── Install Python dependencies ───────────────────────────────────────────────
# Copy requirements first so Docker can cache this layer.
# The layer is only rebuilt when requirements.txt actually changes.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ── Copy application source ───────────────────────────────────────────────────
COPY . .

# ── Security: run as a non-root user ─────────────────────────────────────────
RUN adduser --disabled-password --gecos "" appuser
USER appuser

# ── Expose the port uvicorn will listen on ───────────────────────────────────
EXPOSE 8000

# ── Start the server ─────────────────────────────────────────────────────────
# --host 0.0.0.0  : listen on all interfaces (required inside Docker)
# --port 8000     : match the EXPOSE above
# --workers 1     : single worker (use Gunicorn + multiple workers in prod)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
