# PelicanEye backend - CPU-only for Railway (faster build, no CUDA)
FROM python:3.11-slim

WORKDIR /app

# Install CPU-only PyTorch first (smaller/faster than CUDA version)
# Ultralytics will use this instead of pulling full torch later
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Then install the rest (ultralytics will skip torch - already satisfied)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

# Railway sets PORT at runtime (often 8080). Must listen on this port for healthcheck to pass.
EXPOSE 8080
ENV PORT=8080
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
