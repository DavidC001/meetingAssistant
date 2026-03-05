"""Service layer for Ollama Docker container management."""
import os
import shutil
import subprocess
import time

import requests


class OllamaService:
    """Manages the Ollama Docker container lifecycle."""

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_docker_command() -> str | None:
        """Locate the docker executable on the system."""
        if os.path.exists("/.dockerenv") or os.path.exists("/run/.containerenv"):
            if os.path.exists("/var/run/docker.sock"):
                return shutil.which("docker")
            return None

        docker_path = shutil.which("docker")
        if docker_path:
            return docker_path

        for path in [
            r"C:\Program Files\Docker\Docker\resources\bin\docker.exe",
            r"C:\Program Files\Docker\Docker\resources\docker.exe",
            r"C:\ProgramData\DockerDesktop\version-bin\docker.exe",
        ]:
            if os.path.exists(path):
                return path

        return None

    @staticmethod
    def _in_container_without_socket() -> bool:
        return (os.path.exists("/.dockerenv") or os.path.exists("/run/.containerenv")) and not os.path.exists(
            "/var/run/docker.sock"
        )

    @staticmethod
    def _docker_unavailable_detail() -> str:
        """Return a human-readable explanation for why Docker is unavailable."""
        if os.path.exists("/.dockerenv") or os.path.exists("/run/.containerenv"):
            if not os.path.exists("/var/run/docker.sock"):
                return (
                    "Docker socket not mounted. To enable Ollama management, "
                    "the Docker socket must be mounted in docker-compose.yml."
                )
            return (
                "Docker CLI not available in container. "
                "Please rebuild the backend container with Docker CLI installed."
            )
        return "Docker command not found. Please ensure Docker is installed and in your PATH."

    def _require_docker(self) -> str:
        """Return Docker command or raise RuntimeError with a friendly message."""
        cmd = self._get_docker_command()
        if not cmd:
            raise RuntimeError(self._docker_unavailable_detail())
        return cmd

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    def get_status(self) -> str:
        """
        Return one of: running | starting | stopped | not_installed | error.
        """
        try:
            docker_cmd = self._get_docker_command()
            if not docker_cmd:
                return "error"

            result = subprocess.run(
                [docker_cmd, "ps", "--filter", "name=^ollama$", "--format", "{{.Names}}"],
                capture_output=True,
                text=True,
                check=False,
            )

            if result.returncode == 0 and result.stdout.strip() == "ollama":
                ollama_host = "host.docker.internal" if os.path.exists("/.dockerenv") else "localhost"
                try:
                    resp = requests.get(f"http://{ollama_host}:11434/api/tags", timeout=2)
                    if resp.status_code == 200:
                        return "running"
                except requests.exceptions.RequestException:
                    pass
                return "starting"

            result = subprocess.run(
                [docker_cmd, "ps", "-a", "--filter", "name=^ollama$", "--format", "{{.Names}}"],
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode == 0 and result.stdout.strip() == "ollama":
                return "stopped"

            return "not_installed"
        except Exception as e:
            print(f"Error checking Ollama status: {e}")
            return "error"

    # ------------------------------------------------------------------
    # Start
    # ------------------------------------------------------------------

    def start(self, model: str = "llama3.2", port: int = 11434) -> dict:
        """
        Start the Ollama Docker container.

        Returns a dict with keys: message, status.
        Raises RuntimeError for infrastructure problems.
        """
        docker_cmd = self._require_docker()

        # Check existing container
        check_result = subprocess.run(
            [docker_cmd, "ps", "-a", "--filter", "name=^ollama$", "--format", "{{.Names}}\t{{.State}}"],
            capture_output=True,
            text=True,
            check=False,
        )

        if check_result.returncode == 0 and check_result.stdout.strip():
            for line in check_result.stdout.strip().split("\n"):
                if "\t" in line:
                    name, state = line.split("\t", 1)
                    if name == "ollama":
                        if state == "running":
                            return {"message": "Ollama container is already running", "status": "running"}
                        if state in ("exited", "created"):
                            result = subprocess.run(
                                [docker_cmd, "start", "ollama"],
                                capture_output=True,
                                text=True,
                                check=False,
                            )
                            if result.returncode == 0:
                                return {"message": "Ollama container started successfully", "status": "starting"}
                            raise RuntimeError(f"Failed to start existing Ollama container: {result.stderr}")

        # Build run command
        docker_command = [
            docker_cmd,
            "run",
            "-d",
            "--name",
            "ollama",
            "-p",
            f"{port}:11434",
            "--restart",
            "unless-stopped",
        ]

        # GPU support (best-effort)
        try:
            gpu_check = subprocess.run(
                [docker_cmd, "run", "--rm", "--gpus", "all", "nvidia/cuda:11.0-base", "nvidia-smi"],
                capture_output=True,
                timeout=5,
                check=False,
            )
            if gpu_check.returncode == 0:
                docker_command.extend(["--gpus", "all"])
        except Exception:
            pass

        docker_command.append("ollama/ollama")

        result = subprocess.run(docker_command, capture_output=True, text=True, check=False)

        if result.returncode != 0:
            raise RuntimeError(f"Failed to start Ollama container: {result.stderr}")

        time.sleep(2)

        try:
            subprocess.run(
                [docker_cmd, "exec", "ollama", "ollama", "pull", model],
                capture_output=True,
                check=False,
            )
        except Exception as e:
            print(f"Warning: Could not pull model {model}: {e}")

        return {"message": f"Ollama container started successfully with model {model}", "status": "starting"}

    # ------------------------------------------------------------------
    # Stop
    # ------------------------------------------------------------------

    def stop(self) -> dict:
        """
        Stop the Ollama Docker container.

        Returns a dict with keys: message, status.
        Raises RuntimeError for infrastructure problems.
        """
        docker_cmd = self._require_docker()

        current_status = self.get_status()
        if current_status in ("stopped", "not_installed"):
            return {"message": "Ollama container is not running", "status": "stopped"}

        result = subprocess.run(
            [docker_cmd, "stop", "ollama"],
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )

        if result.returncode != 0:
            raise RuntimeError(f"Failed to stop Ollama container: {result.stderr}")

        return {"message": "Ollama container stopped successfully", "status": "stopped"}

    # ------------------------------------------------------------------
    # Remove
    # ------------------------------------------------------------------

    def remove(self) -> dict:
        """
        Stop and remove the Ollama Docker container.

        Returns a dict with key: message.
        Raises RuntimeError for infrastructure problems.
        """
        docker_cmd = self._require_docker()

        subprocess.run([docker_cmd, "stop", "ollama"], capture_output=True, check=False, timeout=30)

        result = subprocess.run(
            [docker_cmd, "rm", "ollama"],
            capture_output=True,
            text=True,
            check=False,
        )

        if result.returncode != 0:
            raise RuntimeError(f"Failed to remove Ollama container: {result.stderr}")

        return {"message": "Ollama container removed successfully"}
