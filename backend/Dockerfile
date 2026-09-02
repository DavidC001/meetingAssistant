# ==============================================================================
# Backend image — multi-stage, two final targets sharing everything possible.
#
#   light  -> backend (API), worker-light   : torch (CPU or CUDA) + sentence-
#             transformers, but no faster-whisper/pyannote/torchcodec. These
#             services never run the transcription/diarization pipeline
#             (see app/core/processing/__init__.py, which lazily imports it).
#   heavy  -> worker (the "heavy" Celery queue running process_meeting_task):
#             everything in `light` plus faster-whisper/pyannote/torchcodec.
#
# Two build args carry all CPU/GPU and light/heavy variation instead of two
# near-duplicate Dockerfiles (the old Dockerfile.cpu / Dockerfile.gpu):
#   TORCH_INDEX  - pip index URL for torch/torchaudio/torchvision
#                  (".../whl/cpu" by default, ".../whl/cu128" for GPU builds)
#   WITH_HEAVY   - "true" installs requirements-heavy.txt into the venv
#
# See docker-compose.yml (target: light / heavy, WITH_HEAVY) and
# docker-compose.gpu.yml (TORCH_INDEX override for the worker service only).
# ==============================================================================

ARG PYTHON_VERSION=3.12

FROM python:${PYTHON_VERSION}-slim AS runtime-base

# Runtime-only system deps: the ffmpeg binary + its shared libs (no -dev
# headers — nothing in requirements compiles against libav* at runtime;
# app.core.base.utils shells out to the ffmpeg binary via subprocess, and
# torchcodec ships wheels).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Model/config caches live on the shared cache_data volume (mounted at
# /app/cache by docker-compose) instead of the container's ~/.cache, so
# downloads survive restarts and aren't duplicated per service.
ENV HF_HOME=/app/cache/hf \
    TORCH_HOME=/app/cache/torch \
    PATH=/opt/venv/bin:$PATH

# ------------------------------------------------------------------------
# builder: installs everything into a venv, parameterized by TORCH_INDEX and
# WITH_HEAVY. Its build-only apt deps (compilers, headers) never reach the
# final image — only /opt/venv is copied out below.
# ------------------------------------------------------------------------
FROM runtime-base AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv

ARG TORCH_INDEX=https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch==2.8.0 torchaudio==2.8.0 torchvision==0.23.0 \
        --index-url ${TORCH_INDEX}

COPY requirements-base.txt requirements-ml.txt requirements-heavy.txt /app/
RUN pip install --no-cache-dir -r /app/requirements-base.txt -r /app/requirements-ml.txt

ARG WITH_HEAVY=false
RUN if [ "$WITH_HEAVY" = "true" ]; then \
        pip install --no-cache-dir -r /app/requirements-heavy.txt ; \
    fi

# ------------------------------------------------------------------------
# light target — backend (API) and worker-light. Build with defaults
# (WITH_HEAVY=false); pass TORCH_INDEX=.../cu128 only if you want a GPU-
# capable API, which is never necessary since these services don't use CUDA.
# ------------------------------------------------------------------------
FROM runtime-base AS light

COPY --from=builder /opt/venv /opt/venv
COPY . /app
RUN mkdir -p /app/cache /app/uploads

EXPOSE 8000

# Default command for the API service; worker-light overrides this via
# docker-compose. --reload is a dev-server feature and has no place here;
# --workers is explicit rather than left to uvicorn's default.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

# ------------------------------------------------------------------------
# heavy target — worker (GPU-bound meeting pipeline). Build with
# WITH_HEAVY=true; pass TORCH_INDEX=.../cu128 for GPU deployments.
# ------------------------------------------------------------------------
FROM runtime-base AS heavy

COPY --from=builder /opt/venv /opt/venv
COPY . /app
RUN mkdir -p /app/cache /app/uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
