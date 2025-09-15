FROM python:3.10-slim

# Install system dependencies including CUDA detection tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    curl \
    wget \
    gnupg2 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and installation script
COPY ./requirements.txt /app/requirements.txt
COPY ./install_pytorch.py /app/install_pytorch.py

# Install Python dependencies with smart CUDA detection
RUN pip install --no-cache-dir --upgrade pip && \
    python /app/install_pytorch.py && \
    pip install --no-cache-dir -r /app/requirements.txt

# Set up cuDNN library paths and create necessary symlinks
RUN if [ -d "/usr/local/lib/python3.10/site-packages/nvidia/cudnn/lib" ]; then \
        cd /usr/local/lib/python3.10/site-packages/nvidia/cudnn/lib && \
        # Create versioned symlinks for cuDNN libraries \
        for lib in libcudnn*.so.9; do \
            ln -sf $lib ${lib}.1.0 2>/dev/null || true; \
            ln -sf $lib ${lib}.1 2>/dev/null || true; \
        done && \
        # Add cuDNN library path to system library path \
        echo "/usr/local/lib/python3.10/site-packages/nvidia/cudnn/lib" > /etc/ld.so.conf.d/cudnn.conf && \
        ldconfig; \
    fi

# Copy the rest of the application code
COPY . /app

# Create necessary directories
RUN mkdir -p /app/cache /app/uploads

# Set environment variable for cuDNN library path
ENV LD_LIBRARY_PATH=/usr/local/lib/python3.10/site-packages/nvidia/cudnn/lib:$LD_LIBRARY_PATH

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
