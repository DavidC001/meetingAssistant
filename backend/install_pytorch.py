#!/usr/bin/env python3
"""
Smart PyTorch installation script that installs CUDA version by default.
During Docker build, CUDA can't be detected, so we install CUDA-capable PyTorch.
The actual CUDA usage will be determined at runtime.
"""
import subprocess
import sys
import os


def run_command(cmd):
    """Run a command and return the result."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)


def install_pytorch():
    """Install PyTorch with CUDA support by default."""
    print("Installing PyTorch with CUDA support...")
    
    # Install PyTorch with CUDA 12.1 support (widely compatible)
    cmd = [sys.executable, '-m', 'pip', 'install', 'torch', 'torchaudio', '--index-url', 'https://download.pytorch.org/whl/cu121']
    
    print(f"Running: {' '.join(cmd)}")
    try:
        subprocess.check_call(cmd)
        print("PyTorch CUDA installation completed successfully")
        
        # Verify installation
        print("Verifying PyTorch installation...")
        verification_cmd = [sys.executable, '-c', 
                          'import torch; print(f"PyTorch version: {torch.__version__}"); print(f"CUDA available: {torch.cuda.is_available()}")'
                          ]
        subprocess.check_call(verification_cmd)
        
    except subprocess.CalledProcessError as e:
        print(f"CUDA installation failed: {e}")
        print("Falling back to CPU-only PyTorch installation")
        try:
            fallback_cmd = [sys.executable, '-m', 'pip', 'install', 'torch', 'torchaudio', '--index-url', 'https://download.pytorch.org/whl/cpu']
            print(f"Running: {' '.join(fallback_cmd)}")
            subprocess.check_call(fallback_cmd)
            print("CPU PyTorch installation completed successfully")
        except subprocess.CalledProcessError as e2:
            print(f"Fallback installation also failed: {e2}")
            raise e2


if __name__ == "__main__":
    install_pytorch()
