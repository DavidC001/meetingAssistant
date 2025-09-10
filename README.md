# Meeting Assistant Web App

This project transforms a powerful meeting transcription and analysis script into a full-fledged web application with a modern frontend, a robust backend, and a scalable architecture.

## Overview

The application allows users to upload meeting recordings (audio or video files). The system then processes the recording in the background to:

1.  **Transcribe** the speech to text using Whisper.
2.  **Identify different speakers** (diarization).
3.  **Analyze the transcript** using a Large Language Model (LLM) to extract a summary, action items, and key decisions.
4.  **Store and manage** this information in a persistent database.

Users can view a history of their meetings, see the results of the analysis, and track their action items through a user-friendly web interface.

## Architecture

The application is built using a microservices-oriented architecture and is fully containerized with Docker for easy deployment.

-   **Frontend:** A **React** single-page application that provides the user interface. It is served by **Nginx**.
-   **Backend:** A **FastAPI** (Python) application that provides a REST API for the frontend, manages the database, and dispatches processing tasks.
-   **Database:** A **PostgreSQL** database for storing all application data.
-   **Background Worker:** A **Celery** worker that performs the heavy lifting of transcription and analysis in the background.
-   **Message Broker:** **Redis** is used to mediate communication between the backend and the Celery workers.

All services are defined in the `docker-compose.yml` file for easy orchestration.

## Getting Started

### Prerequisites

-   Docker
-   Docker Compose

### Running the Application

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Set up environment variables:**
    Create a `.env` file in the `backend` directory and add your `OPENAI_API_KEY` if you plan to use the OpenAI backend.
    ```
    OPENAI_API_KEY=your_key_here
    ```

3.  **Build and run the services:**
    ```bash
    docker-compose up --build
    ```

4.  **Access the application:**
    -   **Frontend:** Open your web browser and navigate to `http://localhost:3000`.
    -   **Backend API Docs:** The FastAPI documentation is available at `http://localhost:8000/docs`.
---

This `README.md` will be updated as the project progresses.
