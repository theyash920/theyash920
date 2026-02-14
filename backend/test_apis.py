import requests
import json

fork_key = "_zvEaHr1rsw6co_79TOiYBkdmaGh8azcPAol4bSK_pqWnSHY"

results = []

# Test 1: RecipeDB (cosylab) - ALL endpoints broken?
results.append("=== RecipeDB (cosylab.iiitd.edu.in) ===")
urls = [
    ("api/search?query=chicken", {"x-api-key": fork_key}),
    ("search_recipe?searchText=chicken", {"x-api-key": fork_key}),
    ("recipe_search_prepro?searchText=chicken", {"x-api-key": fork_key}),
    ("api/recipe/1", {"x-api-key": fork_key}),
    ("recipeInfo_json?id=1", {"x-api-key": fork_key}),
]
for path, h in urls:
    try:
        r = requests.get(f"https://cosylab.iiitd.edu.in/recipedb/{path}", headers=h, timeout=10)
        results.append(f"  {r.status_code} | {path}")
    except Exception as e:
        results.append(f"  ERR | {path} | {e}")

# Test 2: FlavorDB
results.append("")
results.append("=== FlavorDB (cosylab.iiitd.edu.in) ===")
try:
    r = requests.get("https://cosylab.iiitd.edu.in/flavordb/entities_json?id=271", timeout=10)
    if r.status_code == 200:
        d = r.json()
        results.append(f"  200 OK | name={d.get('entity_alias_readable','?')} | molecules={len(d.get('molecules',[]))}")
    else:
        results.append(f"  {r.status_code} | {r.text[:100]}")
except Exception as e:
    results.append(f"  ERR | {e}")

# Test 3: Foodoscope API
results.append("")
results.append("=== Foodoscope API (api.foodoscope.com) ===")
base = "https://api.foodoscope.com"

# root
try:
    r = requests.get(f"{base}/", timeout=10)
    results.append(f"  Root: {r.status_code} | {r.text[:80]}")
except Exception as e:
    results.append(f"  Root ERR: {e}")

# search with x-api-key
try:
    r = requests.get(f"{base}/recipe/search?query=chicken&pageSize=1", headers={"x-api-key": fork_key}, timeout=10)
    results.append(f"  Search (x-api-key): {r.status_code} | {r.text[:120]}")
except Exception as e:
    results.append(f"  Search ERR: {e}")

# search with -x-api-key (the key name starts with underscore, maybe the header is different)
try:
    r = requests.get(f"{base}/recipe/search?query=chicken&pageSize=1", headers={"Authorization": fork_key}, timeout=10)
    results.append(f"  Search (Auth raw): {r.status_code} | {r.text[:120]}")
except Exception as e:
    results.append(f"  Search ERR: {e}")

# Try with key in URL
try:
    r = requests.get(f"{base}/recipe/search?query=chicken&pageSize=1&apikey={fork_key}", timeout=10)
    results.append(f"  Search (query param): {r.status_code} | {r.text[:120]}")
except Exception as e:
    results.append(f"  Search ERR: {e}")

with open("test_results.txt", "w") as f:
    f.write("\n".join(results))
print("\n".join(results))
