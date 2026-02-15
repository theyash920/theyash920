# 🍳 AI Recipe Assistant - Voice-First Cooking Companion

The **AI Recipe Assistant** is a hands-free, voice-controlled cooking companion designed to help you in the kitchen when your hands are full. Powered by **Foodoscope APIs (RecipeDB & FlavorDB)** and **LLMs**, it provides scientifically accurate recipes, step-by-step guidance, and intelligent ingredient substitutions.

---

## 🚀 Key Features

### 1. 🗣️ Hands-Free Voice Interface
- **Continuous Conversation**: No need to keep tapping a button. The assistant listens, responds, and waits for your next command.
- **Step-by-Step Delivery**: Recipes are read out one step at a time ("Ready for the next step?"), ensuring you can follow along without rushing.
- **Context Awareness**: Remembers your conversation history so you can ask follow-up questions like "Repeat that" or "How much salt?".

### 2. 🧪 Scientific Recipe Intelligence (Foodoscope)
- **RecipeDB Integration**: Fetches verified, cookable recipes from IIIT Delhi's CosyLab database instead of hallucinating random instructions.
- **FlavorDB Integration**: Uses molecular science to suggest **ingredient substitutions**. If you're missing an item, it checks flavor compound compatibility to offer the best scientific alternative.

### 3. 👤 Personalized Chef Profile
- Learns your preferences during onboarding:
  - **Dietary Restrictions** (Vegetarian, Gluten-Free, etc.)
  - **Spice Tolerance** (Mild, Medium, Hot)
  - **Language** (English / Hindi)
- The AI adapts every response to your profile.

---

## 🛠️ Tech Stack

### Frontend (Mobile App)
- **Framework**: React Native (Expo)
- **Voice**: `expo-av` (Recording), `expo-speech` (TTS)
- **Navigation**: Expo Router
- **State**: React Hooks & Context

### Backend (API)
- **Framework**: Python FastAPI
- **AI/LLM**: Groq (Llama-3-70b) or Local Ollama
- **Speech-to-Text**: Whisper (OpenAI or Local)
- **Data Sources**: 
  - **RecipeDB API** (Search & Details)
  - **FlavorDB API** (Molecular Flavor Profiles)

---

## 🔧 Installation & Setup

### Prerequisites
- Node.js & npm
- Python 3.9+
- Expo Go app on your phone (or Android Emulator)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/ai-recipe-assistant.git
cd ai-recipe-assistant
```

### 2. Backend Setup
Navigate to the backend folder and install dependencies:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the root directory with your keys:
```env
EXPO_PUBLIC_GROQ_API_KEY=your_groq_key
EXPO_PUBLIC_FORK_API_KEY=your_foodoscope_key
EXPO_PUBLIC_BACKEND_URL=http://YOUR_LOCAL_IP:8000
```

Run the server:
```bash
python main.py
```

### 3. Frontend Setup
In a new terminal, go to the project root:
```bash
npm install
npx expo start
```
Scan the QR code with your phone to run the app!

---

## 📸 Demo

*(Add screenshots or a link to your demo video here)*

---

## 🏆 Hackathon Tracks
- **Foodoscope API Integration**: Uses RecipeDB for search and FlavorDB for scientific substitutions.
- **Voice UI**: Completely hands-free operation.
- **Personalization**: Custom dietary and spice profiles.

---

Built with ❤️ by [Your Name] using **CosyLab APIs @ IIIT Delhi**.
