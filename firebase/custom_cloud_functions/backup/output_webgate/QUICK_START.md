# ⚡ QUICK START - Deploy u 2 Minute

## 🎯 Najbrža Opcija (Copy-Paste)

### Za Linux/Mac:
```bash
chmod +x deploy-gptnix.sh && ./deploy-gptnix.sh
```

### Za Windows PowerShell:
```powershell
.\deploy-gptnix.ps1
```

### Za Windows Command Prompt:
```bash
gcloud run deploy gptnix-backend --source . --region us-central1 --clear-base-image
```

---

## ✅ To je to!

After deployment:
1. Copy URL iz output-a
2. Test: `curl YOUR_URL/health`
3. Poveži frontend

---

## 🔧 Optional: Set Environment Variables

```bash
gcloud run services update gptnix-backend \
  --region us-central1 \
  --update-env-vars "OPENAI_API_KEY=sk-xxx,DEEPSEEK_API_KEY=sk-xxx"
```

---

Za više detalja vidi **README_DEPLOYMENT.md** 📖
