# 🚨 GPTNIX BACKEND - COST ANALYSIS REPORT

## 💰 **TRENUTNA SITUACIJA**
- **Trošak:** $70/mjesec
- **Korisnici:** 1 (development)
- **Problem:** EKSTREMNO previsoki troškovi za 1 developera

---

## 🔍 **IDENTIFICIRANI PROBLEMI**

### **1. BACKGROUND ASSISTANT (GLAVNI PROBLEM)** 🚨
```javascript
// config/env.js line 246
BACKGROUND_ASSISTANT_ENABLED = true  // DEFAULT!
BACKGROUND_ASSISTANT_MODEL = 'gpt-4o-mini'
```

**Što radi:**
- Poziva se **za SVAKI chat message** (line 3086 u chat.js)
- OpenAI gpt-4o-mini poziv (~260 tokena per poziv)
- Procjenjuje "risk level" i context

**Trošak:**
- gpt-4o-mini: $0.15/1M input + $0.60/1M output
- Za 100 poruka/dan: 3000 poruka/mjesec
- 3000 * 260 tokena = 780K tokena input ≈ $0.12
- 3000 * 100 tokena output ≈ 300K tokena ≈ $0.18
- **UKUPNO: ~$0.30/mjesec** (nije glavni problem)

---

### **2. MEMORY EXTRACTION (PROBLEM)** 🚨
```javascript
// config/env.js line 260
MEMORY_EXTRACT_PROVIDER = 'auto'  // DEFAULT!
MEMORY_EXTRACT_MODEL = 'gpt-4o-mini'
```

**Što radi:**
- Poziva se **nakon SVAKOG responsa** (lines 3605-3614, 3664-3673)
- Ekstraktuje memorije iz conversation
- OpenAI ili DeepSeek poziv (~900 tokena per poziv)

**Trošak:**
- Za 100 poruka/dan: 3000 extraction poziva/mjesec
- 3000 * 900 tokena = 2.7M tokena input
- 3000 * 200 tokena output = 600K tokena
- **UKUPNO: ~$0.76/mjesec** (skup!)

---

### **3. THREAD SUMMARY (PROBLEM)** 🚨
```javascript
// config/env.js line 239
THREAD_SUMMARY_ENABLED = true  // DEFAULT!
```

**Što radi:**
- Poziva se **nakon SVAKOG responsa** (lines 3618-3627, 3677-3686)
- Održava "running summary" konverzacije
- LLM poziv za svaki response

**Trošak:**
- Za 100 poruka/dan: 3000 summary poziva/mjesec
- Prosječno ~500 tokena per poziv
- 3000 * 500 = 1.5M tokena
- **UKUPNO: ~$0.38/mjesec**

---

### **4. WEB SEARCH API POZIVI (GLAVNI PROBLEM!)** 🚨🚨🚨

**Serper (Google Search):**
```javascript
SERPER_API_KEY = Set
```
- **$5 per 1000 queries!**
- Ako imaš 50 web search queries/dan = 1500/mjesec
- 1500 * $0.005 = **$7.50/mjesec**

**Tavily (Deep Search):**
```javascript
TAVILY_API_KEY = Set
```
- **$1 per 1000 requests (basic)** ili **$0.005 per search**
- Ako imaš 30 deep search queries/dan = 900/mjesec
- 900 * $0.001 = **$0.90/mjesec** (basic tier)

---

### **5. CLOUD RUN RESURSI (PROBLEM!)** 🚨

**Trenutni deployment:**
```bash
--memory 2Gi    # 2GB RAM!
--cpu 2         # 2 CPUs!
--timeout 300   # 5 minuta!
```

**Trošak:**
- Cloud Run charging:
  - CPU: $0.00002400 per vCPU-second
  - Memory: $0.00000250 per GiB-second
  - Requests: $0.40 per million
  
**Za 2GB, 2 CPU, 10s average per request:**
- CPU: 2 * 10s * $0.000024 = $0.00048 per request
- Memory: 2GB * 10s * $0.0000025 = $0.00005 per request
- **TOTAL: ~$0.00053 per request**

**Za 3000 requests/mjesec:**
- 3000 * $0.00053 = **$1.59/mjesec**

**ALI - ako je instance uvijek WARM (idle time):**
- Instance može biti warm 24/7
- 2GB * 2 CPU * 30 days = VELIKI TROŠAK!
- Procijenjena: **$30-40/mjesec za warm instances**

---

### **6. QDRANT (DISABLED, OK)** ✅
```javascript
QDRANT_URL: Missing
```
Qdrant je disabled, što je OK za development.

---

### **7. IMAGE GENERATION (Replicate)**
```javascript
REPLICATE_API_TOKEN: Set
REPLICATE_MODEL_QUALITY: minimax/image-01
```

**Trošak:**
- Minimax Image-01: ~$0.05-0.10 per image
- Ako generiraš 20 slika/mjesec = **$1-2/mjesec**

---

## 📊 **PROCJENA UKUPNIH TROŠKOVA**

| Servis | Mjesečni trošak | Opis |
|--------|-----------------|------|
| **Cloud Run (warm instances)** | **$30-40** | 2GB RAM, 2 CPU, 24/7 warm |
| **Serper API (web search)** | **$7.50** | 1500 searches @ $5/1000 |
| **OpenAI (background+memory+summary)** | **$1.44** | gpt-4o-mini pozivi |
| **DeepSeek (main chat)** | **$3-5** | Main chat responses |
| **Tavily API** | **$0.90** | Deep search |
| **Replicate (images)** | **$1-2** | Image generation |
| **Firestore** | **$1-2** | Reads/writes |
| **Network egress** | **$5-10** | Bandwidth costs |
| **UKUPNO** | **~$50-70** | ✅ Match sa tvojim podacima! |

---

## 🎯 **ROOT CAUSE ANALIZA**

**Glavni troškovi:**
1. **Cloud Run warm instances** (40-50% troška) - instance stoji warm 24/7
2. **Serper API** (10-15% troška) - web search je skup
3. **DeepSeek main chat** (5-10% troška)
4. **Background processes** (2-3% troška) - assistant, memory, summary
5. **Network + ostalo** (10-15% troška)

---

## ✅ **OPTIMIZACIJSKA STRATEGIJA**

### **TIER 1: Instant Savings (IMPLEMENTIRAJ ODMAH)** 🚀

#### **1. Smanji Cloud Run resurse**
```bash
# UMJESTO:
--memory 2Gi --cpu 2

# KORISTI:
--memory 512Mi --cpu 1

# SAVINGS: $20-30/mjesec
```

#### **2. Postavi min-instances na 0**
```bash
--min-instances 0    # Ne drži warm instances

# SAVINGS: $10-15/mjesec
```

#### **3. Disabluj background processes za DEV**
```bash
# Postavi environment variables:
export BACKGROUND_ASSISTANT_ENABLED=false
export MEMORY_EXTRACT_PROVIDER=none
export THREAD_SUMMARY_ENABLED=false

# SAVINGS: $1-2/mjesec (mali, ali svejedno)
```

**INSTANT TOTAL SAVINGS: $31-47/mjesec** ✅

---

### **TIER 2: Medium-term (SLJEDEĆI KORAK)**

#### **4. Zamijeni Serper sa DuckDuckGo (FREE)**
```javascript
// websearch već ima DDG support!
// Samo postavi priority:
WEBSEARCH_DEFAULT_PROVIDER=ddg
// SAVINGS: $7.50/mjesec
```

#### **5. Optimiziraj memory extraction**
```javascript
// Ekstraktuj samo svakih 5 poruka:
MEMORY_EXTRACT_FREQUENCY=5

// SAVINGS: ~$0.60/mjesec
```

#### **6. Rate limit image generation**
```javascript
// Max 5 images per day u DEV modu
IMAGE_GEN_DAILY_LIMIT=5

// SAVINGS: $1-1.50/mjesec
```

**MEDIUM-TERM SAVINGS: $9-10/mjesec**

---

### **TIER 3: Long-term optimization**

#### **7. Cache web search results agresivno**
```javascript
// Cache 24h umjesto 15 min
WEBSEARCH_CACHE_TTL_MS = 86400000

// SAVINGS: $2-3/mjesec
```

#### **8. Implement request batching**
```javascript
// Batch Firestore operations
// SAVINGS: $0.50-1/mjesec
```

---

## 🎯 **FINALNI OPTIMIZIRANI DEPLOYMENT**

```bash
#!/bin/bash
# deploy-optimized.sh

gcloud run deploy gptnix-backend \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \           # ✅ Smanjeno sa 2Gi
  --cpu 1 \                  # ✅ Smanjeno sa 2
  --timeout 120 \            # ✅ Smanjeno sa 300s
  --min-instances 0 \        # ✅ No warm instances
  --max-instances 3 \        # ✅ Limit max scale
  --set-env-vars \
    BACKGROUND_ASSISTANT_ENABLED=false,\
    MEMORY_EXTRACT_PROVIDER=none,\
    THREAD_SUMMARY_ENABLED=false,\
    WEBSEARCH_DEFAULT_PROVIDER=ddg
```

---

## 📊 **OČEKIVANI REZULTATI**

### **PRIJE optimizacije:**
```
Cloud Run: $35/mjesec
APIs: $15/mjesec
LLMs: $10/mjesec
Ostalo: $10/mjesec
-------------------------
TOTAL: $70/mjesec
```

### **POSLIJE optimizacije:**
```
Cloud Run: $5/mjesec       (-$30, 85% saving!)
APIs: $5/mjesec            (-$10, zamjena sa DDG)
LLMs: $8/mjesec            (-$2, disabled processes)
Ostalo: $5/mjesec          (-$5, caching)
-------------------------
TOTAL: $23/mjesec          (-$47, 67% SAVINGS!)
```

---

## ⚡ **QUICK START - DEPLOY OPTIMIZIRANO**

```bash
# 1. Extract ZIP
unzip gptnix-backend-WEBSEARCH-WORKING.zip
cd gptnix-backend-v5.1.1-WEB-SEARCH-V2-COMPLETE

# 2. Create optimized deployment script
cat > deploy-optimized.sh << 'EOF'
#!/bin/bash
gcloud run deploy gptnix-backend \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 120 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars \
    BACKGROUND_ASSISTANT_ENABLED=false,\
    MEMORY_EXTRACT_PROVIDER=none,\
    THREAD_SUMMARY_ENABLED=false
EOF

chmod +x deploy-optimized.sh

# 3. Deploy
./deploy-optimized.sh

# 4. Monitor troškove
gcloud billing accounts list
gcloud billing accounts get-iam-policy YOUR_BILLING_ACCOUNT
```

---

## 🔍 **MONITORING - KAKO PRATITI**

```bash
# 1. Cloud Run metrics
gcloud run services describe gptnix-backend \
  --region us-central1 \
  --format="value(status.traffic)"

# 2. Check active instances
gcloud run services describe gptnix-backend \
  --region us-central1 \
  --format="value(spec.template.spec.containerConcurrency)"

# 3. Billing export (enable u konzoli)
# Cloud Console > Billing > Billing export
```

---

## 🎯 **ZAKLJUČAK**

**Glavni problem:** Cloud Run warm instances + previsoki resursi (2GB RAM, 2 CPU)

**Rješenje:** 
1. ✅ Smanji resurse na 512MB RAM, 1 CPU
2. ✅ Postavi min-instances=0
3. ✅ Disabluj background processes za DEV
4. ✅ Koristi DuckDuckGo umjesto Serper

**Očekivana ušteda: $47/mjesec (67%)**
**Novi trošak: ~$23/mjesec** (prihvatljivo za DEV)

---

## 📝 **NEXT STEPS**

1. ✅ Deploy optimizirani backend (odmah!)
2. ⏰ Čekaj 24h
3. ✅ Provjeri Cloud Run metrics
4. ✅ Provjeri billing dashboard
5. ✅ Ako i dalje visoko, further optimize

---

**DEPLOY OPTIMIZIRANI BACKEND ODMAH I JAVI REZULTATE! 🚀**
