# 🎬 AI Recipe Assistant - Video Submission Script (5-6 Minutes)

## 🎥 Scene 1: The Hook (0:00 - 0:45)
**Visual:** [Face to Camera] or [Montage of someone struggling in the kitchen with dirty hands trying to scroll on a phone screen]
**Audio:** 
"We’ve all been there. You’re in the middle of cooking, hands covered in flour or oil, and your phone screen locks. Or worse, you realize you're missing an ingredient and don't know what to substitute."

**Visual:** [Cut to "AI Recipe Assistant" Logo/Title Screen]
**Audio:**
"Cooking apps today are just digital cookbooks—static, dumb, and disconnected from the reality of your kitchen.

But what if your recipe app was a *real* intelligent sous-chef? One that listens to you, talks back, guides you step-by-step, and uses **molecular food science** to make decisions?

I’m [Your Name], and this is **AI Recipe Assistant**—a hands-free, voice-first cooking companion powered by **Foodoscope APIs**."

---

## 💡 Scene 2: Solution Explanation (0:45 - 1:30)
**Visual:** [Screen recording of the App Home Screen - Clean, minimal voice interface]
**Audio:**
"Our solution transforms the cooking experience by removing the friction of touch screens. We built a 'Headless' UI that relies on continuous voice conversation.

It’s not just a chatbot. It’s personalized.
During onboarding, it learns your:
1.  **Dietary Restrictions** (e.g., Vegetarian, Gluten-Free)
2.  **Spice Tolerance** (Visual: Showing the profile settings)
3.  **Language Preference** (Supports English & Hindi)

The core innovation? It doesn't just hallucinate recipes. It connects your voice directly to **IIIT Delhi’s CosyLab APIs (Foodoscope)** to fetch scientifically accurate recipe and flavor data."

---

## 🛠️ Scene 3: Live Demo & API Integration (1:30 - 3:30)
**⚠️ CRITICAL SECTION: Show the specific API usage here**

### Part A: Recipe Discovery (RecipeDB Integration)
**Visual:** [Split screen: App on Left, Terminal/Code Log on Right]
**Action:** User taps mic and says: *"I have paneer and spinach. What can I cook?"*
**Audio (User):** "I have paneer and spinach. What can I cook?"
**Visual (Terminal):** Highlight the log output: `[Chat] Recipe query detected, searching Foodoscope...` and the API call to `https://cosylab.iiitd.edu.in/recipedb/api/search`.
**Audio (Narrator):** 
"Here, the system detects a recipe intent. Instead of asking the LLM immediately, we first hit the **RecipeDB API**.
You can see the request going to the CosyLab server to fetch verified recipes containing 'Paneer' and 'Spinach'. This ensures the user gets a real, cookable dish, not an AI hallucination."

**Audio (AI Voice from App):** "You can make Palak Paneer! It’s a delicious North Indian vegetarian dish. Shall I list the ingredients?"

### Part B: Step-by-Step Guidance (Context Management)
**Action:** User says: *"Yes, let's start."*
**Audio (AI Voice):** "Great. First, blanch the spinach... Ready for the next step?"
**Audio (Narrator):**
"Notice the **Step-by-Step Delivery**. The system prompt is engineered to wait for the user. It remembers context across the conversation history, so you can just say 'Next' or 'Repeat that'."

### Part C: The "Science" Substitution (FlavorDB Integration)
**Action:** User says: *"Wait, I don't have cream. What can I use instead?"*
**Visual (Terminal):** **ZOOM IN** on the backend log. Show: `fetching flavor data locally / FlavorDB` or `get_flavor_profile_summary`.
**Audio (Narrator):** 
"This is where it gets interesting. A normal AI might guess 'milk'. 
Our system queries **FlavorDB** to check the molecular flavor profile of 'Cream'. It analyzes shared flavor compounds to suggest the best scientific substitute."
**Audio (AI Voice):** "You can swap cream with Cashew Paste. It shares a creamy texture and nutty flavor profile that pairs well with spinach."

---

## 🏗️ Scene 4: Architecture Brief (3:30 - 4:45)
**Visual:** [Simple Architecture Diagram Overlay]
**Audio:** 
"Let’s break down how this works under the hood. We verified a hybrid architecture:

1.  **Frontend**: React Native Expo app with `expo-av` for audio recording.
2.  **Backend**: A Python FastAPI server (`main.py`).
3.  **The Intelligence Layer**:
    *   **Whisper** handles Speech-to-Text.
    *   **Foodoscope (RecipeDB)** provides structural recipe data.
    *   **FlavorDB** provides molecular ingredient data.
    *   **LLM (Llama-3/Groq)** acts as the orchestrator—it takes the user query + Foodoscope data + User Profile and generates the final natural response.

This 'Retrieval Augmented Generation' (RAG) approach ensures our AI is grounded in real data, making it safer and more reliable than generic chatbots."

---

## 🚀 Scene 5: Impact & Closing Vision (4:45 - 5:30)
**Visual:** [Montage of completed dish or happy user]
**Audio:** 
"Why does this matter?
By integrating **Foodoscope**, we’re moving beyond simple recipe apps to **Scientific Culinary Assistance**.

We solve the 'dirty hands' problem with voice.
We solve the 'what to cook' problem with RecipeDB.
We solve the 'missing ingredient' problem with FlavorDB.

This serves not just home cooks, but has potential for dietary management and food waste reduction by suggesting scientifically valid use of leftovers.

Thank you."
