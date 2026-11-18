FROM python:3.12-slim AS base

WORKDIR /app

# Install dependencies
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# Copy source
COPY deploykit/ ./deploykit/

ENTRYPOINT ["deploykit"]
CMD ["--help"]
