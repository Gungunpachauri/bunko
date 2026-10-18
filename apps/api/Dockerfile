# syntax=docker/dockerfile:1
# The API image. Docker Compose builds it as is; the Hugging Face demo sets DEMO=1, which also bakes in the
# classics shelf, its search index and the search models, so a fresh server starts full and answers at once.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
# Hugging Face runs containers as user 1000, so the app and its data belong to that user.
RUN useradd -m -u 1000 user
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=user app ./app
COPY --chown=user worker.py mcp_server.py ./
RUN mkdir -p /app/data && chown user /app/data
USER user

ARG DEMO=0
ARG GRAPH_MINUTES=15
# AI keys are mounted only for this step (to map a few books onto the reading map) and never stored in the image.
RUN --mount=type=secret,id=GEMINI_API_KEY,mode=0444,required=false \
    --mount=type=secret,id=GROQ_API_KEY,mode=0444,required=false \
    if [ "$DEMO" = "1" ]; then \
      GEMINI_API_KEY="$(cat /run/secrets/GEMINI_API_KEY 2>/dev/null)" \
      GROQ_API_KEY="$(cat /run/secrets/GROQ_API_KEY 2>/dev/null)" \
      python -m app.demo --graph-minutes "$GRAPH_MINUTES"; \
    fi

ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
