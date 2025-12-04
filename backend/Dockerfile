# ==============================================
# Default Dockerfile - GPU version
# ==============================================
# For CPU-only builds, use: docker build -f Dockerfile.cpu
# For explicit GPU builds, use: docker build -f Dockerfile.gpu
#
# This file uses the NVIDIA PyTorch base image with CUDA pre-installed
FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime

# Install system dependencies and Docker CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    ffmpeg \
    libavformat-dev \
    libavcodec-dev \
    libavdevice-dev \
    libavutil-dev \
    libswscale-dev \
    libswresample-dev \
    libavfilter-dev \
    curl \
    wget \
    gnupg2 \
    ca-certificates \
    && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# Install cuDNN 9 libraries required by ctranslate2/faster-whisper
# This ensures the libraries are in the standard library path
RUN pip install --no-cache-dir nvidia-cudnn-cu12==9.1.0.70

# Set LD_LIBRARY_PATH to include the cuDNN libraries installed via pip
ENV LD_LIBRARY_PATH="/opt/conda/lib/python3.11/site-packages/nvidia/cudnn/lib:${LD_LIBRARY_PATH}"

# Set working directory
WORKDIR /app

# Copy and install Python dependencies (PyTorch already installed in base image)
COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

# Copy the rest of the application code
COPY . /app

# Create necessary directories
RUN mkdir -p /app/cache /app/uploads

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
