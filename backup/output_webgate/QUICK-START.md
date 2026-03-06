# GPTNiX Backend - Quick Start

## 1. Setup (5 min)

```bash
# Unzip
unzip gptnix-backend-PRODUCTION.zip
cd gptnix-production

# Install
npm install

# Configure
cp .env.example .env
```

## 2. Edit .env

**Minimum required:**
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
DEEPSEEK_API_KEY=sk-xxx
```

## 3. Start

```bash
npm start
```

Backend runs on http://localhost:8080

## 4. Test

```bash
# Health check
curl http://localhost:8080/health

# Chat test (need Firebase token)
curl -X POST http://localhost:8080/chat \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "test",
    "message": "Hello",
    "stream": false
  }'
```

## 5. Deploy to Cloud Run

```bash
# Quick deploy
export GOOGLE_CLOUD_PROJECT=your-project-id
./deploy-gptnix.sh
```

## Optional: Enable Features

### Web Search
```env
TAVILY_API_KEY=tvly-xxx  # Recommended
# or
SERPER_API_KEY=xxx       # Alternative
# Falls back to DuckDuckGo if neither provided
```

### RAG (Semantic Search)
```env
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=xxx
```

### Voice
```env
# OpenAI TTS/STT automatically enabled if OPENAI_API_KEY set
OPENAI_TTS_VOICE=alloy
OPENAI_TTS_MODEL=tts-1
```

### Image Generation
```env
REPLICATE_API_TOKEN=r8_xxx
REPLICATE_MODEL=minimax/image-01
```

### External Tools
```env
WEATHER_API_KEY=xxx      # Weather data
TMDB_API_KEY=xxx         # Movies
GEOAPIFY_API_KEY=xxx     # Maps/geocoding
```

## Firestore Setup

Create Firestore database with these collections:
```
conversations/
memory/
billing/
admin_access/
```

All collections auto-create on first write.

## Troubleshooting

### "Firebase not initialized"
- Check FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL
- Ensure private key has `\n` for newlines

### "No LLM API key"
- Set DEEPSEEK_API_KEY or OPENAI_API_KEY

### "Slow responses"
- Check TTFB in logs
- Reduce MAX_HISTORY (default 20)
- Disable web search for testing

### "High costs"
- Use DeepSeek ($0.001/1K tokens) instead of OpenAI ($0.03/1K)
- Limit MAX_TOKENS (default 4096)

## What's Included

✅ Chat (streaming SSE)
✅ Web Search (Tavily/Serper/DDG/ScrapeDev)
✅ Image Generation (Replicate)
✅ Voice (TTS/STT)
✅ RAG (Qdrant vector DB)
✅ Memory (semantic facts)
✅ Attachments (PDF, DOCX, XLSX, CSV)
✅ External Tools (weather, movies, wiki, osm, etc.)
✅ Billing (cost tracking)
✅ Admin panel

## Documentation

- `README-MAIN.md` - Full feature list
- `START_HERE.md` - Detailed setup
- `DEPLOY.md` - Deployment guide
- `README_WEB_SEARCH_V2.md` - Web search docs
- `CHANGELOG*.md` - Version history

## Deploy Commands

### Cloud Run (recommended)
```bash
./deploy-gptnix.sh
```

### Cloud Run (with build)
```bash
./deploy-gptnix-build.sh
```

### Docker Local
```bash
docker build -t gptnix-backend .
docker run -p 8080:8080 --env-file .env gptnix-backend
```

## Next Steps

1. Test locally with `npm start`
2. Deploy to Cloud Run
3. Point FlutterFlow to your Cloud Run URL
4. Enable optional features as needed

**Need help?** Check existing docs in the zip or open an issue.
