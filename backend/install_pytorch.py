#!/usr/bin/env python3
"""
Smart PyTorch installation script.
Detects if CUDA is available and installs the appropriate PyTorch version.
Can be forced via environment variable PYTORCH_INSTALL_MODE or command line argument.
Modes: 'cuda', 'cpu', 'auto' (default)

CUDA version can be specified via CUDA_VERSION environment variable (e.g., '12.1', '11.8').
If not specified, auto-detection is attempted.
"""
import subprocess
import sys
import os
import platform
import re

# Pin specific versions to ensure compatibility with requirements.txt
# and to avoid conflicts between the manual install and pip install -r requirements.txt
TORCH_VERSION = "2.4.1"
TORCHAUDIO_VERSION = "2.4.1"
TORCHVISION_VERSION = "0.19.1"

# Supported CUDA versions and their PyTorch wheel suffixes
# Order matters: prefer newer versions first for auto-detection matching
SUPPORTED_CUDA_VERSIONS = {
    "12.4": "cu124",
    "12.1": "cu121",
    "11.8": "cu118",
}

def get_cuda_version():
    """
    Detect the installed CUDA version using nvidia-smi.
    Returns version string like '12.1' or None if not available.
    """
    try:
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=driver_version', '--format=csv,noheader'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return None
        
        # Get CUDA version from nvidia-smi (shows CUDA runtime version)
        result = subprocess.run(
            ['nvidia-smi'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return None
        
        # Parse output for CUDA Version: XX.X
        match = re.search(r'CUDA Version:\s*(\d+\.\d+)', result.stdout)
        if match:
            return match.group(1)
        
        return None
    except (OSError, subprocess.TimeoutExpired, FileNotFoundError):
        return None

def get_best_cuda_wheel(cuda_version):
    """
    Given a CUDA version string (e.g., '12.4'), return the best matching PyTorch wheel suffix.
    PyTorch wheels are backward compatible within major versions, so we pick the closest
    supported version that is <= the installed version.
    """
    if not cuda_version:
        return None
    
    try:
        major, minor = map(int, cuda_version.split('.')[:2])
        installed = (major, minor)
    except (ValueError, IndexError):
        return None
    
    # Find the best matching wheel (highest version <= installed)
    best_match = None
    best_version = (0, 0)
    
    for ver_str, wheel_suffix in SUPPORTED_CUDA_VERSIONS.items():
        try:
            ver_major, ver_minor = map(int, ver_str.split('.'))
            ver_tuple = (ver_major, ver_minor)
            
            # Must be same major version and <= installed minor version
            if ver_major == major and ver_tuple <= installed and ver_tuple > best_version:
                best_version = ver_tuple
                best_match = wheel_suffix
        except (ValueError, IndexError):
            continue
    
    return best_match

def get_cuda_availability():
    """Check if CUDA is available on the system via nvidia-smi."""
    try:
        subprocess.check_call(['nvidia-smi'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except (OSError, subprocess.CalledProcessError, FileNotFoundError):
        return False

def install_pytorch(mode="auto"):
    system = platform.system().lower()
    print(f"Detected system: {system}")
    print(f"Requested install mode: {mode}")
    
    use_cuda = False
    cuda_wheel = None
    
    if mode.lower() == "cuda":
        use_cuda = True
        print("Mode set to CUDA (forced).")
    elif mode.lower() == "cpu":
        use_cuda = False
        print("Mode set to CPU (forced).")
    else:  # auto
        print("Auto-detecting CUDA availability...")
        if get_cuda_availability():
            print("NVIDIA GPU detected via nvidia-smi.")
            use_cuda = True
        else:
            print("No NVIDIA GPU detected (or nvidia-smi failed). Defaulting to CPU.")
            use_cuda = False

    # Determine CUDA wheel version
    if use_cuda:
        # Check for explicit CUDA_VERSION env var first
        env_cuda_version = os.environ.get("CUDA_VERSION")
        if env_cuda_version:
            print(f"Using CUDA version from environment: {env_cuda_version}")
            cuda_wheel = get_best_cuda_wheel(env_cuda_version)
            if not cuda_wheel:
                # Try direct mapping if env var is like "cu121"
                if env_cuda_version.startswith("cu"):
                    cuda_wheel = env_cuda_version
                else:
                    print(f"Warning: Could not map CUDA {env_cuda_version} to a wheel, attempting auto-detection...")
        
        # Auto-detect if not set or mapping failed
        if not cuda_wheel:
            detected_version = get_cuda_version()
            if detected_version:
                print(f"Detected CUDA version: {detected_version}")
                cuda_wheel = get_best_cuda_wheel(detected_version)
                if cuda_wheel:
                    print(f"Selected PyTorch wheel: {cuda_wheel}")
                else:
                    print(f"Warning: CUDA {detected_version} not directly supported, using latest available (cu124)")
                    cuda_wheel = "cu124"
            else:
                print("Could not detect CUDA version, defaulting to cu121 (widely compatible)")
                cuda_wheel = "cu121"

    # Define packages with versions
    packages = [
        f'torch=={TORCH_VERSION}',
        f'torchaudio=={TORCHAUDIO_VERSION}',
        f'torchvision=={TORCHVISION_VERSION}'
    ]
    
    if use_cuda:
        print(f"Installing PyTorch {TORCH_VERSION} with CUDA support ({cuda_wheel})...")
        index_url = f'https://download.pytorch.org/whl/{cuda_wheel}'
        cmd = [sys.executable, '-m', 'pip', 'install'] + packages + ['--index-url', index_url]
    else:
        print(f"Installing PyTorch {TORCH_VERSION} for CPU...")
        index_url = 'https://download.pytorch.org/whl/cpu'
        cmd = [sys.executable, '-m', 'pip', 'install'] + packages + ['--index-url', index_url]

    print(f"Running: {' '.join(cmd)}")
    try:
        subprocess.check_call(cmd)
        print("PyTorch installation completed successfully.")
        
        # Verify installation
        print("Verifying PyTorch installation...")
        verification_cmd = [
            sys.executable, '-c', 
            'import torch; print(f"PyTorch version: {torch.__version__}"); print(f"CUDA available: {torch.cuda.is_available()}"); print(f"CUDA version: {torch.version.cuda if torch.cuda.is_available() else None}"); print(f"Device count: {torch.cuda.device_count()}")'
        ]
        subprocess.check_call(verification_cmd)
        
    except subprocess.CalledProcessError as e:
        print(f"Installation failed: {e}")
        # If CUDA installation fails in auto mode, try falling back to CPU
        if use_cuda and mode.lower() == "auto":
            print("CUDA installation failed. Falling back to CPU-only installation...")
            try:
                index_url = 'https://download.pytorch.org/whl/cpu'
                cmd = [sys.executable, '-m', 'pip', 'install'] + packages + ['--index-url', index_url]
                print(f"Running fallback: {' '.join(cmd)}")
                subprocess.check_call(cmd)
                print("CPU PyTorch fallback installation successful.")
            except subprocess.CalledProcessError as e2:
                print(f"Fallback installation also failed: {e2}")
                sys.exit(1)
        else:
            sys.exit(1)

if __name__ == "__main__":
    # Priority: Command line arg > Env var > Default 'auto'
    mode = os.environ.get("PYTORCH_INSTALL_MODE", "auto")
    if len(sys.argv) > 1:
        mode = sys.argv[1]
    
    install_pytorch(mode)
