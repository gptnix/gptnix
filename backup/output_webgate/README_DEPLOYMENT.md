# 🚀 GPTNiX Backend V4.3 - FIXED for Cloud Run

## ✅ Što je popravljeno?

1. **Deployment greška riješena** - Dodan `--clear-base-image` fix
2. **Deployment skripte dodane** - Bash i PowerShell skripte za automatski deployment
3. **.gcloudignore** kreiran - Optimizirani uploads na Cloud Run
4. **DEPLOYMENT_FIX.md** - Detaljna dokumentacija problema i rješenja
5. **Ažuriran DEPLOY.md** - Sa novim instrukcijama i opcijama

---

## 🎯 BRZI START (3 opcije)

### Opcija 1: Koristi Skriptu (NAJLAKŠE) ⭐

**Linux/Mac:**
```bash
chmod +x deploy-gptnix.sh
./deploy-gptnix.sh
```

**Windows PowerShell:**
```powershell
.\deploy-gptnix.ps1
```

**Windows Git Bash:**
```bash
bash deploy-gptnix.sh
```

---

### Opcija 2: Jedna Komanda (NAJBRŽE)

```bash
gcloud run deploy gptnix-backend \
  --source . \
  --region us-central1 \
  --clear-base-image \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 300s
```

---

### Opcija 3: Build + Deploy (NAJSIGURNIJE)

```bash
# Korak 1: Build image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/gptnix-backend .

# Korak 2: Deploy image
gcloud run deploy gptnix-backend \
  --image gcr.io/YOUR_PROJECT_ID/gptnix-backend \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 📋 Pre-Deployment Checklist

1. **gcloud CLI instaliran i konfiguriran**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **.env fajl kreiran** (kopiraj iz .env.example)
   ```bash
   cp .env.example .env
   # Edit .env sa svojim API keyevima
   ```

3. **Firebase credentials** (optional, ali preporučeno)
   - Downloadaj serviceAccountKey.json iz Firebase Console
   - Stavi ga u root folder projekta

4. **Qdrant setup** (ako koristiš memory/RAG)
   - Postavi QDRANT_URL i QDRANT_API_KEY u .env

---

## 🔧 Post-Deployment

### 1. Postavi Environment Variables

```bash
gcloud run services update gptnix-backend \
  --region us-central1 \
  --update-env-vars "$(cat .env | grep -v '^#' | grep -v '^$' | tr '\n' ',')"
```

### 2. Test Health Endpoint

```bash
SERVICE_URL=$(gcloud run services describe gptnix-backend --region us-central1 --format 'value(status.url)')
curl $SERVICE_URL/health
```

**Očekuješ:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-12T...",
  "version": "4.3.0"
}
```

### 3. Test Chat Endpoint

```bash
curl -X POST $SERVICE_URL/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Bok!",
    "userId": "test",
    "conversationId": "test-123"
  }'
```

---

## 📁 Fajlovi u Paketu

```
gptnix-backend-v4.3-FIXED/
├── src/                          # Source code
├── .env.example                  # Example environment variables
├── .dockerignore                 # Docker ignore rules
├── .gcloudignore                 # Cloud Run ignore rules (NEW)
├── Dockerfile                    # Container definition
├── index.js                      # Entry point
├── package.json                  # Dependencies
├── deploy-gptnix.sh             # Bash deployment script (NEW)
├── deploy-gptnix-build.sh       # Bash build+deploy script (NEW)
├── deploy-gptnix.ps1            # PowerShell deployment script (NEW)
├── deploy-gptnix-build.ps1      # PowerShell build+deploy script (NEW)
├── DEPLOY.md                     # Deployment guide (UPDATED)
├── DEPLOYMENT_FIX.md            # Fix documentation (NEW)
├── README.md                     # This file (NEW)
└── [other docs...]              # Various documentation
```

---

## 🚨 Troubleshooting

### Problem: `Missing required argument [--clear-base-image]`
**Rješenje:** Dodaj `--clear-base-image` flag u komandu
```bash
gcloud run deploy gptnix-backend --source . --region us-central1 --clear-base-image
```

### Problem: Build timeout
**Rješenje:** Koristi Build + Deploy pristup (2 koraka)

### Problem: Health endpoint ne radi
**Rješenje:** 
1. Provjeri logs: `gcloud run logs read gptnix-backend --limit 50`
2. Provjeri PORT environment variable
3. Provjeri Dockerfile EXPOSE direktivu

### Problem: Environment variables ne rade
**Rješenje:** Postavi ih nakon deployamenta:
```bash
gcloud run services update gptnix-backend \
  --region us-central1 \
  --update-env-vars "KEY1=value1,KEY2=value2"
```

---

## 📊 Performance Optimizacije

Backend je optimiziran za:
- ⚡ **Instant responses** - Pattern matching za česte upite (< 5ms)
- 🎯 **Smart routing** - Deterministički routing za 80% upita
- 💾 **Semantic memory** - Qdrant vector search
- 🔍 **Web search** - Multi-provider search integration
- 📄 **RAG** - Document processing i retrieval
- 🎬 **17+ tools** - Movies, weather, wiki, memory, i više

---

## 📚 Dokumentacija

- **DEPLOY.md** - Kompletan deployment guide
- **DEPLOYMENT_FIX.md** - Detalji o --clear-base-image fix-u
- **START_HERE.md** - Brzi start guide
- **V4.3_RELEASE_NOTES.md** - Release notes
- **CHANGELOG.md** - Sve promjene

---

## 🆘 Pomoć

Ako imaš problema:

1. Provjeri **DEPLOYMENT_FIX.md** za česta pitanja
2. Provjeri logs: `gcloud run logs read gptnix-backend --limit 100`
3. Testiraj lokalno: `docker build -t test . && docker run -p 8080:8080 test`
4. Kontaktiraj na: nboskic@gmail.com

---

## ✅ Success Checklist

- [ ] gcloud CLI konfiguriran
- [ ] .env fajl kreiran sa API keyevima
- [ ] Deployment prošao bez greške
- [ ] Health endpoint vraća OK
- [ ] Chat endpoint radi
- [ ] Environment variables postavljeni
- [ ] Frontend povezan na novi URL

---

## 🎉 Deployment uspješan!

Ako si došao do ovdje, sve je deployano! 

**Service URL:** Provjeri output od `gcloud run deploy` komande

**Next steps:**
1. Poveži frontend na novi URL
2. Testiraj sve features
3. Monitor logs u real-time
4. Enjoy! 🚀

---

**GPTNiX V4.3** - Built with ❤️ by Nikola Bošković
