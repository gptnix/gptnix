# 🔧 GPTNiX V4.3 - Deployment Fix

## ❌ Problem
```
ERROR: (gcloud.run.deploy) Missing required argument [--clear-base-image]: 
Base image is not supported for services built from Dockerfile.
```

## ✅ Rješenja

### Opcija 1: Brzo Rješenje (1 komanda)

Dodaj `--clear-base-image` flag u postojeću komandu:

```bash
gcloud run deploy gptnix-backend --source . --region us-central1 --clear-base-image
```

---

### Opcija 2: Kompletan Deployment (preporučeno)

Sa svim potrebnim parametrima:

```bash
gcloud run deploy gptnix-backend \
  --source . \
  --region us-central1 \
  --clear-base-image \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300s \
  --min-instances 1 \
  --max-instances 10 \
  --port 8080
```

---

### Opcija 3: Build pa Deploy (2 koraka - najsigurnija opcija)

#### Korak 1: Build image
```bash
gcloud builds submit --tag gcr.io/gptnix-backend-440718/gptnix-backend .
```

#### Korak 2: Deploy image
```bash
gcloud run deploy gptnix-backend \
  --image gcr.io/gptnix-backend-440718/gptnix-backend \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300s \
  --min-instances 1 \
  --max-instances 10 \
  --port 8080
```

---

### Opcija 4: Koristi Skriptu (najlakše)

#### Za Windows (PowerShell):
```powershell
# 1. Otvori PowerShell u project folderu
cd "C:\Users\ASUS ExpertBook\AppData\Roaming\FlutterFlow\flutterflow\g_p_t_ni_x\firebase\custom_cloud_functions"

# 2. Pokreni jednom od:
.\deploy-gptnix.ps1           # Source deploy
.\deploy-gptnix-build.ps1     # Build + Deploy
```

#### Za Linux/Mac (Bash):
```bash
# 1. Napravi skriptu izvršnom
chmod +x deploy-gptnix.sh

# 2. Pokreni
./deploy-gptnix.sh           # Source deploy
./deploy-gptnix-build.sh     # Build + Deploy
```

---

## 📝 Objašnjenje Problema

Google Cloud Run ima dva načina deployanja:
1. **Source-based** - builduješ iz source code-a (traži `--clear-base-image`)
2. **Image-based** - builduješ image prvo, pa deployaš

Problem se javlja kada:
- Ranije si deployovao sa nekim base image konfiguracijom
- Sada pokušavaš deployat iz Dockerfile-a
- Cloud Run ne može koristiti stari base image config sa novim Dockerfile-om

---

## 🔄 Post-Deployment: Environment Variables

Nakon deployamenta, postavi environment varijable:

```bash
# Ako imaš .env fajl
gcloud run services update gptnix-backend \
  --region us-central1 \
  --update-env-vars "$(cat .env | grep -v '^#' | grep -v '^$' | tr '\n' ',')"

# Ili pojedinačno:
gcloud run services update gptnix-backend \
  --region us-central1 \
  --update-env-vars "OPENAI_API_KEY=sk-xxx,DEEPSEEK_API_KEY=sk-xxx"
```

---

## 🧪 Testing Nakon Deployamenta

```bash
# 1. Dohvati service URL
SERVICE_URL=$(gcloud run services describe gptnix-backend --region us-central1 --format 'value(status.url)')

# 2. Test health endpoint
curl $SERVICE_URL/health

# 3. Test chat endpoint
curl -X POST $SERVICE_URL/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Bok!", "userId": "test", "conversationId": "test-123"}'
```

---

## 🚨 Troubleshooting

### Ako deployment i dalje ne radi:

1. **Provjeri da si u pravom folderu:**
```bash
pwd  # Trebao bi biti u gptnix-v4.3 folderu
ls   # Trebaš vidjeti Dockerfile, package.json, index.js
```

2. **Provjeri Dockerfile:**
```bash
cat Dockerfile  # Trebao bi početi sa "FROM node:20-slim"
```

3. **Očisti stari service (OPREZ!):**
```bash
# Ovo briše postojeći service! Koristi samo ako si siguran
gcloud run services delete gptnix-backend --region us-central1
```

4. **Provjeri logs:**
```bash
gcloud run logs read gptnix-backend --region us-central1 --limit 50
```

---

## 📊 Deployment Timeline

| Korak | Vrijeme | Opis |
|-------|---------|------|
| Build | 2-3 min | Buildanje Docker image-a |
| Deploy | 1-2 min | Deployanje na Cloud Run |
| Env Vars | 30 sec | Postavljanje environment varijabli |
| **UKUPNO** | **4-6 min** | Od `gcloud` do live servisa |

---

## 💡 Best Practices

1. **Uvijek koristi `--clear-base-image`** kada deployaš iz source-a sa Dockerfile-om
2. **Test lokalno prvo:** `docker build -t gptnix-test . && docker run -p 8080:8080 gptnix-test`
3. **Čuvaj backup:** Prije deployamenta, sačuvaj URL starog servisa
4. **Postavi min-instances:** Za produkciju koristi `--min-instances 1` da izbjegneš cold starts
5. **Monitor logs:** Nakon deployamenta, odmah provjeri `gcloud run logs read`

---

## 🎉 Success Checklist

- [ ] Deployment prošao bez greške
- [ ] Health endpoint vraća `{"status":"ok"}`
- [ ] Chat endpoint radi (vraća odgovor)
- [ ] Environment varijable su postavljene
- [ ] Service URL je zabilježen
- [ ] Frontend povezan na novi URL

---

## 📞 Podrška

Ako i dalje imaš problema, provjeri:
- [Cloud Run Documentation](https://cloud.google.com/run/docs/deploying-source-code)
- [Dockerfile Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- Logs: `gcloud run logs read gptnix-backend --limit 100`
