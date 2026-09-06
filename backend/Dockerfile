FROM python:3.12-slim

WORKDIR /app

# Copy requirements from either current dir or backend/
COPY requirements.txt* backend/requirements.txt* ./

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/* && \
    (if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; elif [ -f backend/requirements.txt ]; then pip install --no-cache-dir -r backend/requirements.txt; fi)

# Copy source code
COPY . .

# Ensure python can import modules from /app and /app/backend
ENV PYTHONPATH="/app:/app/backend"

EXPOSE 8000
CMD ["sh", "-c", "if [ -f main.py ]; then uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}; else uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}; fi"]
