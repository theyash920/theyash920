# AI Recipe Assistant Implementation Log

## Overview
This document tracks the implementation steps completed for the full-stack AI Recipe Assistant application.

## 1. Backend Implementation (FastAPI)
- **Directory**: `backend/`
- **Dependencies**: `fastapi`, `uvicorn`, `groq`, `requests`, `deep-translator`, `python-dotenv`.
- **Key Files**:
    - `main.py`: Central application logic.
    - `requirements.txt`: Python dependencies.
- **Features**:
    - `GET /recipe/{id}`: Fetches recipes from RecipeDB (CosyLab) or falls back to sample data. Parses ingredients, steps, and nutrition.
    - `GET /search`: Searches recipes by name.
    - `POST /chat`: Context-aware AI chat. Uses Groq (Llama-3) to answer cooking questions. Detects substitution queries and fetches scientific data from FlavorDB. Supports Hindi translation.
    - `GET /visual-checkpoint`: Returns image URLs for cooking steps (using Unsplash Source).
    - `GET /flavor/{id}`: Fetches flavor molecule data from FlavorDB.

## 2. Frontend Implementation (React Native / Expo)
- **Framework**: React Native with Expo Router.
- **Key Screens**:
    - **Onboarding**: Added "Chef Profile" form (Language, Dietary, Spice Tolerance). stored in `AsyncStorage`.
    - **Recipe Search**: Real-time search using backend API.
    - **Recipe Detail**: Displays ingredients, steps, and a "Nutritional Info" modal.
    - **Cooking Mode**: 
        - State machine for step-by-step cooking.
        - **Voice Interaction**: Records audio -> Whisper (STT) -> Backend Chat -> TTS response.
        - **Visual Checkpoints**: Updates step image every 3 steps.
        - **Animations**: Lottie animations for AI speaking/thinking.

## 3. Configuration
- **Environment Variables**:
    - `EXPO_PUBLIC_GROQ_API_KEY`: For voice transcription (Whisper).
    - `EXPO_PUBLIC_FORK_API_KEY`: For CosyLab APIs.
    - `EXPO_PUBLIC_BACKEND_URL`: Points to FastAPI server (default: `http://localhost:8000`).
