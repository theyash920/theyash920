"""
AI Recipe Assistant — FastAPI Backend
Connects RecipeDB, FlavorDB, Ollama (local LLM), and image search services.
Uses Ollama with Llama 3.1 8B for AI chat instead of cloud APIs.
"""

import os
import json
import requests
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tempfile

# Load environment variables from project root .env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

FORK_API_KEY = os.getenv("EXPO_PUBLIC_FORK_API_KEY")
GROQ_API_KEY = os.getenv("EXPO_PUBLIC_GROQ_API_KEY")  # Kept only for Whisper STT
# Correct Foodoscope API base URL (NOT cosylab.iiitd.edu.in which returns 404s)
FOODOSCOPE_API_BASE = "https://api.foodoscope.com/api"
FLAVORDB_BASE = "https://cosylab.iiitd.edu.in/flavordb"

# Ollama local configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:latest")

app = FastAPI(title="AI Recipe Assistant", version="1.0.0")

# Allow all origins for Expo development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic Models ─────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    user_context: dict  # {language, dietary_restrictions, spice_tolerance}
    recipe_context: Optional[dict] = None  # {recipe_title, current_step, ingredients, all_steps} — optional for general chat
    question: str
    conversation_history: Optional[list] = None  # [{role: "user"/"assistant", content: "..."}] for multi-turn

class ChatResponse(BaseModel):
    answer: str
    is_substitution: bool
    flavor_data: Optional[dict] = None

# ─── Helper: Ollama Chat ─────────────────────────────────────────────────────

def ollama_chat(messages: list, temperature: float = 0.7) -> str:
    """Send a chat request to the local Ollama server and return the response text."""
    url = f"{OLLAMA_BASE_URL}/api/chat"
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": 300,  # equivalent to max_tokens
        },
    }
    try:
        print(f"[Ollama] Sending request to {url} with model {OLLAMA_MODEL}")
        resp = requests.post(url, json=payload, timeout=120)
        print(f"[Ollama] Response status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            answer = data.get("message", {}).get("content", "")
            print(f"[Ollama] Response length: {len(answer)} chars")
            return answer
        else:
            print(f"[Ollama] Error: {resp.text[:300]}")
            raise Exception(f"Ollama returned {resp.status_code}: {resp.text[:200]}")
    except requests.exceptions.ConnectionError:
        raise Exception("Cannot connect to Ollama. Make sure Ollama is running (ollama serve).")
    except requests.exceptions.Timeout:
        raise Exception("Ollama request timed out. The model may be loading or the request is too complex.")


# ─── Helper: Foodoscope Auth Header ──────────────────────────────────────────

def get_foodoscope_headers() -> dict:
    """Get correct auth headers for Foodoscope API (Bearer token, not x-api-key)."""
    if FORK_API_KEY:
        return {"Authorization": f"Bearer {FORK_API_KEY}"}
    return {}


# ─── Helper: RecipeDB (via Foodoscope API) ───────────────────────────────────

def fetch_recipe(recipe_id: int) -> dict:
    """Fetch a recipe from RecipeDB by ID."""
    headers = get_foodoscope_headers()
    url = f"{FOODOSCOPE_API_BASE}/recipe/{recipe_id}"
    try:
        print(f"[RecipeDB] Fetching recipe {recipe_id} from {url}")
        resp = requests.get(url, headers=headers, timeout=10)
        print(f"[RecipeDB] Response: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            if data:
                return data
        else:
            print(f"[RecipeDB] Error: {resp.text[:200]}")
    except Exception as e:
        print(f"[RecipeDB] Exception: {e}")
    return None


def search_recipes_api(query: str, page: int = 1) -> list:
    """Search recipes from Foodoscope RecipeDB API."""
    headers = get_foodoscope_headers()
    url = f"{FOODOSCOPE_API_BASE}/recipe/search?searchText={query}&pageSize=5&page={page}"
    try:
        print(f"[RecipeDB] Searching: {url}")
        resp = requests.get(url, headers=headers, timeout=10)
        print(f"[RecipeDB] Search response: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            if data:
                return data if isinstance(data, list) else data.get("results", data.get("recipes", data.get("payload", [])))
        else:
            print(f"[RecipeDB] Search error: {resp.text[:200]}")
    except Exception as e:
        print(f"[RecipeDB] Search exception: {e}")
    return None


def search_recipes_for_chat(query: str) -> str:
    """Search RecipeDB and return a compact text summary for the LLM context.
    This reduces token usage by giving the LLM real data instead of generating from scratch."""
    results = search_recipes_api(query)
    if not results:
        return ""

    summaries = []
    for r in results[:3]:  # Limit to top 3 recipes
        title = r.get("recipe_title", r.get("title", "Unknown"))
        cuisine = r.get("cuisine", "Unknown")
        ingredients = r.get("ingredients", [])
        if isinstance(ingredients, list):
            ing_names = [ing.get("ingredient_name", ing.get("name", "")) for ing in ingredients[:8]]
        else:
            ing_names = []
        summaries.append(f"- {title} ({cuisine}): {', '.join(ing_names)}")

    if summaries:
        return "RECIPES FROM RECIPEDB (use these real recipes in your response):\n" + "\n".join(summaries)
    return ""


# ─── Helper: FlavorDB ────────────────────────────────────────────────────────

def fetch_flavor_data(ingredient_id: int) -> dict:
    """Fetch flavor/molecular data from FlavorDB for a specific ingredient."""
    try:
        url = f"{FLAVORDB_BASE}/entities_json?id={ingredient_id}"
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        print(f"FlavorDB fetch error: {e}")
    return None


def get_flavor_profile_summary(ingredient_id: int) -> dict:
    """Get a simplified flavor profile for an ingredient."""
    data = fetch_flavor_data(ingredient_id)
    if not data:
        return None

    molecules = data.get("molecules", [])
    flavor_profiles = set()
    for mol in molecules[:10]:  # Limit to top 10 molecules
        profile = mol.get("flavor_profile", "")
        if profile:
            for f in profile.split("@"):
                flavor_profiles.add(f.strip())

    return {
        "entity_id": data.get("entity_id"),
        "name": data.get("entity_alias_readable", "Unknown"),
        "category": data.get("category_readable", "Unknown"),
        "flavor_profiles": list(flavor_profiles)[:15],
        "molecule_count": len(molecules),
    }


# ─── Helper: Translation ─────────────────────────────────────────────────────

def translate_text(text: str, target_lang: str = "hi") -> str:
    """Translate text using deep_translator. Falls back to original on error."""
    if target_lang == "en":
        return text
    try:
        from deep_translator import GoogleTranslator
        translator = GoogleTranslator(source='auto', target=target_lang)
        return translator.translate(text)
    except Exception as e:
        print(f"Translation error: {e}")
        return text


# ─── Helper: Image Search ────────────────────────────────────────────────────

def search_images(query: str) -> str:
    """Search for a cooking step image. Uses Unsplash as a free source."""
    try:
        # Use Unsplash Source API (free, no key required) for cooking images
        clean_query = query.replace(" ", "+")
        return f"https://source.unsplash.com/800x600/?cooking,{clean_query}"
    except Exception:
        return "https://source.unsplash.com/800x600/?cooking"


# ─── Sample Data (fallback when RecipeDB API is unreachable) ─────────────────

SAMPLE_RECIPES = [
    {
        "id": 1,
        "title": "Butter Chicken (Murgh Makhani)",
        "image": "https://source.unsplash.com/800x600/?butter-chicken",
        "cuisine": "Indian",
        "category": "Non-Vegetarian",
        "prep_time": "30 mins",
        "cook_time": "40 mins",
        "servings": 4,
        "ingredients": [
            {"name": "Chicken", "quantity": "500", "unit": "g", "ingredient_id": 271},
            {"name": "Yogurt", "quantity": "1", "unit": "cup", "ingredient_id": 282},
            {"name": "Butter", "quantity": "3", "unit": "tbsp", "ingredient_id": 186},
            {"name": "Tomato", "quantity": "4", "unit": "medium", "ingredient_id": 304},
            {"name": "Cream", "quantity": "0.5", "unit": "cup", "ingredient_id": 190},
            {"name": "Onion", "quantity": "2", "unit": "medium", "ingredient_id": 464},
            {"name": "Garlic", "quantity": "6", "unit": "cloves", "ingredient_id": 376},
            {"name": "Ginger", "quantity": "1", "unit": "inch", "ingredient_id": 380},
            {"name": "Garam Masala", "quantity": "1", "unit": "tsp", "ingredient_id": 519},
            {"name": "Turmeric", "quantity": "0.5", "unit": "tsp", "ingredient_id": 537},
            {"name": "Red Chili Powder", "quantity": "1", "unit": "tsp", "ingredient_id": 523},
            {"name": "Salt", "quantity": "to taste", "unit": "", "ingredient_id": None},
        ],
        "steps": [
            "Marinate the chicken with yogurt, turmeric, red chili powder, and salt for at least 30 minutes.",
            "Heat butter in a heavy-bottomed pan over medium heat.",
            "Add finely chopped onions and sauté until golden brown, about 8-10 minutes.",
            "Add minced garlic and grated ginger, cook for 2 minutes until fragrant.",
            "Add pureed tomatoes and cook until the oil separates from the masala, about 10 minutes.",
            "Add the marinated chicken pieces and cook on high heat for 5 minutes, stirring occasionally.",
            "Lower the heat, cover, and simmer for 15 minutes until the chicken is cooked through.",
            "Add garam masala and stir well to combine with the sauce.",
            "Pour in the cream, stir gently, and simmer for 5 more minutes on low heat.",
            "Garnish with fresh cream and coriander leaves. Serve hot with naan or rice.",
        ],
        "nutrition": {
            "calories": 490,
            "protein": 38,
            "fat": 28,
            "carbs": 18,
            "fiber": 3,
        },
    },
    {
        "id": 2,
        "title": "Palak Paneer",
        "image": "https://source.unsplash.com/800x600/?palak-paneer",
        "cuisine": "Indian",
        "category": "Vegetarian",
        "prep_time": "20 mins",
        "cook_time": "25 mins",
        "servings": 4,
        "ingredients": [
            {"name": "Spinach", "quantity": "500", "unit": "g", "ingredient_id": 458},
            {"name": "Paneer", "quantity": "250", "unit": "g", "ingredient_id": 200},
            {"name": "Onion", "quantity": "1", "unit": "large", "ingredient_id": 464},
            {"name": "Tomato", "quantity": "2", "unit": "medium", "ingredient_id": 304},
            {"name": "Garlic", "quantity": "4", "unit": "cloves", "ingredient_id": 376},
            {"name": "Ginger", "quantity": "1", "unit": "inch", "ingredient_id": 380},
            {"name": "Green Chili", "quantity": "2", "unit": "pieces", "ingredient_id": 110},
            {"name": "Cream", "quantity": "2", "unit": "tbsp", "ingredient_id": 190},
            {"name": "Cumin Seeds", "quantity": "1", "unit": "tsp", "ingredient_id": 516},
            {"name": "Garam Masala", "quantity": "0.5", "unit": "tsp", "ingredient_id": 519},
        ],
        "steps": [
            "Blanch the spinach in boiling water for 2-3 minutes, then transfer to ice water immediately.",
            "Blend the blanched spinach into a smooth puree and set aside.",
            "Cut paneer into cubes and lightly fry until golden on all sides. Set aside.",
            "Heat oil in a pan, add cumin seeds and let them splutter.",
            "Add chopped onions and sauté until translucent, about 5 minutes.",
            "Add minced garlic, grated ginger, and green chilies. Cook for 1 minute.",
            "Add chopped tomatoes and cook until soft and mushy, about 5 minutes.",
            "Pour in the spinach puree and mix well. Cook on medium heat for 5 minutes.",
            "Add the fried paneer cubes and garam masala. Simmer for 3-4 minutes.",
            "Finish with a swirl of cream. Serve hot with roti or naan.",
        ],
        "nutrition": {
            "calories": 320,
            "protein": 18,
            "fat": 22,
            "carbs": 14,
            "fiber": 5,
        },
    },
    {
        "id": 3,
        "title": "Chicken Biryani",
        "image": "https://source.unsplash.com/800x600/?chicken-biryani",
        "cuisine": "Indian",
        "category": "Non-Vegetarian",
        "prep_time": "45 mins",
        "cook_time": "60 mins",
        "servings": 6,
        "ingredients": [
            {"name": "Basmati Rice", "quantity": "2", "unit": "cups", "ingredient_id": 96},
            {"name": "Chicken", "quantity": "750", "unit": "g", "ingredient_id": 271},
            {"name": "Onion", "quantity": "3", "unit": "large", "ingredient_id": 464},
            {"name": "Yogurt", "quantity": "1", "unit": "cup", "ingredient_id": 282},
            {"name": "Tomato", "quantity": "2", "unit": "medium", "ingredient_id": 304},
            {"name": "Mint Leaves", "quantity": "0.5", "unit": "cup", "ingredient_id": 433},
            {"name": "Coriander Leaves", "quantity": "0.5", "unit": "cup", "ingredient_id": 118},
            {"name": "Saffron", "quantity": "a pinch", "unit": "", "ingredient_id": 72},
            {"name": "Ghee", "quantity": "4", "unit": "tbsp", "ingredient_id": 187},
            {"name": "Biryani Masala", "quantity": "2", "unit": "tbsp", "ingredient_id": 519},
        ],
        "steps": [
            "Wash and soak basmati rice in water for 30 minutes, then drain.",
            "Marinate chicken with yogurt, biryani masala, salt, and half the mint and coriander. Rest for 30 minutes.",
            "Boil water with whole spices, add the soaked rice, and cook until 70% done. Drain and set aside.",
            "Heat ghee in a heavy-bottomed pot and fry sliced onions until deep golden brown.",
            "Add the marinated chicken and cook on high heat for 5 minutes, stirring well.",
            "Add chopped tomatoes and cook until the chicken is half done, about 10 minutes.",
            "Layer the partially cooked rice over the chicken. Sprinkle saffron milk on top.",
            "Add remaining mint and coriander leaves. Dot with ghee.",
            "Seal the pot with aluminum foil and a tight lid. Cook on dum (very low heat) for 25 minutes.",
            "Gently mix the layers and serve hot with raita and salad.",
        ],
        "nutrition": {
            "calories": 580,
            "protein": 35,
            "fat": 20,
            "carbs": 62,
            "fiber": 3,
        },
    },
    {
        "id": 4,
        "title": "Masala Dosa",
        "image": "https://source.unsplash.com/800x600/?masala-dosa",
        "cuisine": "South Indian",
        "category": "Vegetarian",
        "prep_time": "8 hours",
        "cook_time": "30 mins",
        "servings": 4,
        "ingredients": [
            {"name": "Rice", "quantity": "2", "unit": "cups", "ingredient_id": 96},
            {"name": "Urad Dal", "quantity": "0.5", "unit": "cup", "ingredient_id": 344},
            {"name": "Potato", "quantity": "4", "unit": "medium", "ingredient_id": 299},
            {"name": "Onion", "quantity": "2", "unit": "medium", "ingredient_id": 464},
            {"name": "Mustard Seeds", "quantity": "1", "unit": "tsp", "ingredient_id": 530},
            {"name": "Curry Leaves", "quantity": "10", "unit": "leaves", "ingredient_id": 362},
            {"name": "Turmeric", "quantity": "0.5", "unit": "tsp", "ingredient_id": 537},
            {"name": "Green Chili", "quantity": "3", "unit": "pieces", "ingredient_id": 110},
        ],
        "steps": [
            "Soak rice and urad dal separately for at least 6 hours or overnight.",
            "Grind them into a smooth batter, mix, add salt, and let it ferment for 8 hours.",
            "Boil potatoes until soft, peel and mash them coarsely.",
            "Heat oil, add mustard seeds, curry leaves, and green chilies. Let them splutter.",
            "Add chopped onions and sauté until golden brown.",
            "Add turmeric and the mashed potatoes. Mix well and cook for 5 minutes.",
            "Heat a flat griddle (tawa), pour a ladle of batter, and spread it in a thin circle.",
            "Drizzle oil around the edges and cook until the dosa turns golden and crispy.",
            "Place the potato filling on one half and fold the dosa over.",
            "Serve hot with coconut chutney and sambar.",
        ],
        "nutrition": {
            "calories": 350,
            "protein": 10,
            "fat": 8,
            "carbs": 60,
            "fiber": 4,
        },
    },
    {
        "id": 5,
        "title": "Dal Makhani",
        "image": "https://source.unsplash.com/800x600/?dal-makhani",
        "cuisine": "North Indian",
        "category": "Vegetarian",
        "prep_time": "8 hours",
        "cook_time": "45 mins",
        "servings": 4,
        "ingredients": [
            {"name": "Black Urad Dal", "quantity": "1", "unit": "cup", "ingredient_id": 344},
            {"name": "Rajma (Kidney Beans)", "quantity": "0.25", "unit": "cup", "ingredient_id": 339},
            {"name": "Butter", "quantity": "3", "unit": "tbsp", "ingredient_id": 186},
            {"name": "Cream", "quantity": "0.25", "unit": "cup", "ingredient_id": 190},
            {"name": "Onion", "quantity": "1", "unit": "large", "ingredient_id": 464},
            {"name": "Tomato", "quantity": "3", "unit": "medium", "ingredient_id": 304},
            {"name": "Garlic", "quantity": "5", "unit": "cloves", "ingredient_id": 376},
            {"name": "Ginger", "quantity": "1", "unit": "inch", "ingredient_id": 380},
            {"name": "Red Chili Powder", "quantity": "1", "unit": "tsp", "ingredient_id": 523},
            {"name": "Garam Masala", "quantity": "0.5", "unit": "tsp", "ingredient_id": 519},
        ],
        "steps": [
            "Soak black urad dal and rajma overnight (at least 8 hours).",
            "Pressure cook the soaked dal and rajma with water and salt for 15-20 minutes until soft.",
            "Heat butter in a heavy pan, add chopped onions and cook until deep brown.",
            "Add ginger-garlic paste and sauté for 2 minutes until the raw smell disappears.",
            "Add tomato puree and cook on medium heat until oil separates, about 8 minutes.",
            "Add red chili powder, garam masala, and stir well.",
            "Add the cooked dal and rajma. Mix well and add water to adjust consistency.",
            "Simmer on very low heat for 20-25 minutes, stirring occasionally.",
            "Stir in cream and a knob of butter. Mix until the dal is rich and creamy.",
            "Garnish with coriander, a dollop of cream, and serve with naan or rice.",
        ],
        "nutrition": {
            "calories": 380,
            "protein": 16,
            "fat": 18,
            "carbs": 42,
            "fiber": 10,
        },
    },
]


# ─── API Endpoints ───────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "message": "AI Recipe Assistant API",
        "version": "2.0.0",
        "llm": f"Ollama ({OLLAMA_MODEL})",
        "ollama_url": OLLAMA_BASE_URL,
    }


@app.get("/health")
def health():
    """Health check — verifies Ollama is reachable."""
    try:
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        ollama_ok = resp.status_code == 200
        models = [m["name"] for m in resp.json().get("models", [])] if ollama_ok else []
    except Exception:
        ollama_ok = False
        models = []

    return {
        "status": "ok" if ollama_ok else "degraded",
        "ollama": {"connected": ollama_ok, "models": models, "active_model": OLLAMA_MODEL},
        "foodoscope_key": bool(FORK_API_KEY),
        "groq_key_for_whisper": bool(GROQ_API_KEY),
    }


@app.get("/search")
def search_recipes(query: str = Query(..., min_length=1), page: int = 1):
    """Search recipes by name. Tries RecipeDB API first, falls back to sample data."""

    # Try RecipeDB API
    results = search_recipes_api(query, page)
    if results:
        # Normalize the response format
        recipes = []
        for r in results:
            recipes.append({
                "id": r.get("recipe_id", r.get("id", 0)),
                "title": r.get("recipe_title", r.get("title", "Unknown")),
                "image": r.get("img_url", r.get("image", "")),
                "cuisine": r.get("cuisine", "Unknown"),
                "category": r.get("category", "General"),
            })
        return {"results": recipes, "source": "recipedb"}

    # Fallback to sample data
    query_lower = query.lower()
    filtered = [
        {
            "id": r["id"],
            "title": r["title"],
            "image": r["image"],
            "cuisine": r["cuisine"],
            "category": r["category"],
        }
        for r in SAMPLE_RECIPES
        if query_lower in r["title"].lower()
        or query_lower in r["cuisine"].lower()
        or query_lower in r["category"].lower()
        or any(query_lower in ing["name"].lower() for ing in r["ingredients"])
    ]

    # If nothing matched, return all sample recipes for discoverability
    if not filtered:
        filtered = [
            {
                "id": r["id"],
                "title": r["title"],
                "image": r["image"],
                "cuisine": r["cuisine"],
                "category": r["category"],
            }
            for r in SAMPLE_RECIPES
        ]

    return {"results": filtered, "source": "sample"}


@app.get("/recipe/{recipe_id}")
def get_recipe(recipe_id: int):
    """Get full recipe details including ingredients, steps, and nutrition."""

    # Try RecipeDB API
    data = fetch_recipe(recipe_id)
    if data:
        # Parse and normalize the RecipeDB response
        ingredients = []
        raw_ingredients = data.get("ingredients", [])
        if isinstance(raw_ingredients, list):
            for ing in raw_ingredients:
                ingredients.append({
                    "name": ing.get("ingredient_name", ing.get("name", "Unknown")),
                    "quantity": str(ing.get("quantity", "")),
                    "unit": ing.get("unit", ""),
                    "ingredient_id": ing.get("ingredient_id", None),
                })

        steps = data.get("instructions", data.get("steps", []))
        if isinstance(steps, str):
            steps = [s.strip() for s in steps.split(".") if s.strip()]

        nutrition = data.get("nutritional_info", data.get("nutrition", {}))
        if isinstance(nutrition, str):
            try:
                nutrition = json.loads(nutrition)
            except Exception:
                nutrition = {}

        return {
            "id": recipe_id,
            "title": data.get("recipe_title", data.get("title", "Unknown Recipe")),
            "image": data.get("img_url", data.get("image", "")),
            "cuisine": data.get("cuisine", "Unknown"),
            "category": data.get("category", "General"),
            "prep_time": data.get("prep_time", ""),
            "cook_time": data.get("cook_time", ""),
            "servings": data.get("servings", 4),
            "ingredients": ingredients,
            "steps": steps if isinstance(steps, list) else [],
            "nutrition": {
                "calories": nutrition.get("calories", nutrition.get("energy", 0)),
                "protein": nutrition.get("protein", 0),
                "fat": nutrition.get("fat", nutrition.get("total_fat", 0)),
                "carbs": nutrition.get("carbs", nutrition.get("carbohydrates", 0)),
                "fiber": nutrition.get("fiber", nutrition.get("dietary_fiber", 0)),
            },
        }

    # Fallback to sample data
    for r in SAMPLE_RECIPES:
        if r["id"] == recipe_id:
            return r

    raise HTTPException(status_code=404, detail=f"Recipe with id {recipe_id} not found")


@app.get("/flavor/{ingredient_id}")
def get_flavor(ingredient_id: int):
    """Get flavor profile for an ingredient from FlavorDB."""
    data = get_flavor_profile_summary(ingredient_id)
    if data:
        return data
    raise HTTPException(status_code=404, detail=f"Flavor data not found for ingredient {ingredient_id}")


@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Transcribe audio to text using Groq Whisper API.
    This endpoint is used by the mobile app to send recorded audio for speech-to-text.
    (Ollama does not support speech-to-text, so Groq Whisper is used for this purpose only.)
    """
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="Groq API key not configured for Whisper transcription")

    try:
        # Read the uploaded file
        audio_data = await file.read()

        # Save to a temp file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name

        try:
            # Send to Groq Whisper
            with open(tmp_path, "rb") as audio_file:
                resp = requests.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                    files={"file": ("recording.wav", audio_file, "audio/wav")},
                    data={"model": "whisper-large-v3-turbo"},
                    timeout=30,
                )

            if resp.status_code == 200:
                transcript = resp.json().get("text", "")
                print(f"[Whisper] Transcribed: {transcript[:100]}...")
                return {"text": transcript}
            else:
                print(f"[Whisper] Error: {resp.status_code} — {resp.text[:200]}")
                raise HTTPException(status_code=502, detail=f"Whisper API error: {resp.text[:200]}")
        finally:
            # Clean up temp file
            os.unlink(tmp_path)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Whisper] Exception: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    """
    Process a user's cooking question with context-aware AI response using local Ollama LLM.
    Works in two modes:
    - COOKING MODE: When recipe_context is provided (from cooking-mode screen)
    - GENERAL CHAT: When no recipe_context (from home screen voice assistant)
    Handles substitution queries with FlavorDB integration in both modes.
    """
    user_ctx = request.user_context
    recipe_ctx = request.recipe_context or {}
    question = request.question.lower()
    history = request.conversation_history or []

    # Detect substitution intent
    substitution_keywords = ["swap", "substitute", "replace", "instead of", "alternative", "use instead"]
    is_substitution = any(kw in question for kw in substitution_keywords)

    # Detect recipe-related intent for Foodoscope integration
    recipe_keywords = ["recipe", "cook", "make", "prepare", "dish", "food", "meal",
                       "बनाना", "खाना", "रेसिपी", "पकाना", "व्यंजन"]
    is_recipe_query = any(kw in question for kw in recipe_keywords)

    flavor_data = None
    flavor_context = ""

    if is_substitution:
        # Try to fetch flavor data for ingredients mentioned in the recipe
        ingredients = recipe_ctx.get("ingredients", [])
        flavor_profiles = []
        for ing in ingredients[:5]:
            ing_id = ing.get("ingredient_id")
            if ing_id:
                profile = get_flavor_profile_summary(ing_id)
                if profile:
                    flavor_profiles.append(profile)

        if flavor_profiles:
            flavor_data = {"profiles": flavor_profiles}
            flavor_context = f"""
SCIENTIFIC FLAVOR DATA (from FlavorDB):
The following ingredients have these molecular flavor profiles:
{json.dumps(flavor_profiles, indent=2)}

Use this data to provide scientifically-backed advice about ingredient substitutions.
Consider flavor molecule compatibility when suggesting alternatives.
"""

    # Build the system prompt
    language = user_ctx.get("language", "English")
    dietary = user_ctx.get("dietary_restrictions", "None")
    spice = user_ctx.get("spice_tolerance", "Medium")

    # Check if we're in cooking mode (has recipe context) or general chat mode
    has_recipe = bool(recipe_ctx.get('recipe_title'))

    if has_recipe:
        # COOKING MODE — specific recipe context
        system_prompt = f"""You are a professional AI cooking assistant with deep knowledge of food science and culinary techniques.

USER PROFILE:
- Dietary Restrictions: {dietary}
- Spice Tolerance: {spice}
- Language Preference: {language}

CURRENT RECIPE: {recipe_ctx.get('recipe_title', 'Unknown')}
CURRENT STEP ({recipe_ctx.get('current_step_index', 0) + 1}): {recipe_ctx.get('current_step', 'N/A')}

FULL RECIPE STEPS:
{json.dumps(recipe_ctx.get('all_steps', []), indent=1)}

INGREDIENTS IN THIS RECIPE:
{json.dumps([ing.get('name', '') for ing in recipe_ctx.get('ingredients', [])], indent=1)}

{flavor_context}

INSTRUCTIONS:
- Respond naturally and helpfully as a cooking guide.
- Keep responses concise (2-4 sentences) since they will be spoken aloud via TTS.
- If the user asks about substitutions, use the FlavorDB data to give scientifically grounded advice.
- Consider the user's dietary restrictions and spice tolerance.
- If the user mentions a specific step, refer to it in your response.
- Respond in {'Hindi' if language.lower() == 'hindi' else 'English'}.
"""
    else:
        # GENERAL CHAT MODE — home screen voice assistant
        # Fetch data from Foodoscope APIs to reduce LLM token usage
        foodoscope_context = ""
        if is_recipe_query:
            print(f"[Chat] Recipe query detected, searching Foodoscope for: {question[:50]}")
            foodoscope_context = search_recipes_for_chat(request.question)
            if foodoscope_context:
                print(f"[Chat] Got Foodoscope data: {len(foodoscope_context)} chars")
            else:
                print("[Chat] No Foodoscope results, LLM will generate from knowledge")

        system_prompt = f"""You are an AI Recipe Assistant and cooking companion powered by Foodoscope (RecipeDB & FlavorDB). Follow these rules strictly:

1. STEP-BY-STEP DELIVERY: When sharing a recipe, NEVER give all steps at once. Give ONLY ONE step at a time. After each step, ask "Ready for the next step?" and WAIT for the user to confirm.
2. RECIPE FORMAT: First tell the recipe name and a brief description. Then list the ingredients. Then say "Let's start cooking! Here's step 1:" and give only the first step.
3. CONCISE: Keep each response short (2-3 sentences max). This is a voice assistant so brevity is key.
4. FRIENDLY: Be warm, encouraging, and conversational.
5. SMART: For substitution questions, ingredient queries, and cooking tips, answer directly and concisely.
6. If the user says "next", "continue", "yes", "go ahead", "okay", or similar, give ONLY the next step.
7. If the user asks your name, say you are the AI Recipe Assistant powered by Foodoscope.
8. IMPORTANT: When recipe data from RecipeDB is provided below, USE it in your response instead of generating recipes from your own knowledge.

USER PROFILE:
- Dietary Restrictions: {dietary}
- Spice Tolerance: {spice}
- Language Preference: {language}

{foodoscope_context}

{flavor_context}

Respond in {'Hindi' if language.lower() == 'hindi' else 'English'}.
"""

    # Build messages array
    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history for multi-turn context
    if history:
        for msg in history:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

    # Add current question
    messages.append({"role": "user", "content": request.question})

    try:
        answer = ollama_chat(messages, temperature=0.7)

        if not answer:
            raise Exception("Empty response from Ollama")

        # Translate if needed
        if language.lower() == "hindi":
            answer = translate_text(answer, "hi")

        return ChatResponse(
            answer=answer,
            is_substitution=is_substitution,
            flavor_data=flavor_data,
        )

    except Exception as e:
        print(f"[Ollama] Chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Ollama error: {str(e)}")


@app.get("/visual-checkpoint")
def visual_checkpoint(query: str = Query(..., min_length=1)):
    """Get an image URL for a cooking step (visual checkpoint)."""
    image_url = search_images(query)
    return {"image_url": image_url, "query": query}


# ─── Run the server ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    print(f"🚀 Starting AI Recipe Assistant API")
    print(f"🤖 LLM: Ollama ({OLLAMA_MODEL}) at {OLLAMA_BASE_URL}")
    print(f"🔑 Foodoscope API Key: {'✅ Set' if FORK_API_KEY else '❌ Not set'}")
    print(f"🎤 Groq Whisper Key: {'✅ Set' if GROQ_API_KEY else '❌ Not set'}")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
