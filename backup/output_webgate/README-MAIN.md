# GPTNiX Backend - Production

**Kompletan, production-ready backend za GPTNiX aplikaciju.**

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env - add Firebase credentials + LLM API key
npm start
```

## Required

```env
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=...
DEEPSEEK_API_KEY=sk-...  # or OPENAI_API_KEY
```

## Features

### Core
- ✅ **Chat** - Streaming SSE, conversation history, auto title generation
- ✅ **Authentication** - Firebase Auth
- ✅ **Persistence** - Firestore (conversations, messages, metadata)
- ✅ **Billing** - Cost tracking, usage analytics, quotas

### AI Providers
- ✅ **DeepSeek** - Primary LLM
- ✅ **OpenAI** - GPT-4, GPT-3.5-turbo
- ✅ **OpenRouter** - Access to 100+ models

### Web Search
- ✅ **Advanced System** - Trust scoring, query classification
- ✅ **Providers** - Tavily, Serper, DuckDuckGo, ScrapeDev
- ✅ **Smart Routing** - Auto-selects best provider
- ✅ **Content Reader** - Fetches full articles
- ✅ **Vision** - OCR for screenshots

### RAG (Retrieval-Augmented Generation)
- ✅ **Vector DB** - Qdrant integration
- ✅ **Document Upload** - PDF, DOCX, XLSX, CSV, TXT
- ✅ **Embeddings** - OpenAI text-embedding-3-small
- ✅ **Semantic Search** - Find relevant context

### Memory
- ✅ **Semantic Memory** - Fact extraction and storage
- ✅ **Context Injection** - Auto-injects relevant memories
- ✅ **Personalization** - User preferences and history

### Voice
- ✅ **Text-to-Speech** - OpenAI TTS (6 voices)
- ✅ **Speech-to-Text** - OpenAI Whisper
- ✅ **Voice Profiles** - Per-user voice settings

### Image Generation
- ✅ **Replicate** - Multiple models (FLUX, MiniMax, SDXL)
- ✅ **Prompt Enhancement** - Auto-improves prompts
- ✅ **Negative Prompts** - Quality control

### External Tools
- ✅ **Weather** - Current weather and forecasts
- ✅ **Movies** - TMDb integration
- ✅ **Wikipedia** - Article summaries
- ✅ **DBpedia** - Structured knowledge
- ✅ **OpenStreetMap** - Location search
- ✅ **Geoapify** - Geocoding and routing
- ✅ **Holidays** - Country-specific holidays
- ✅ **Currency** - Exchange rates
- ✅ **Cars** - Vehicle information (US only)

### Attachments
- ✅ **File Upload** - Multer integration
- ✅ **Text Extraction** - PDF, DOCX, XLSX, CSV
- ✅ **OCR** - Google Cloud Vision
- ✅ **Context Injection** - Auto-includes file content

## API Endpoints

### Chat
```
POST /chat
- Main chat endpoint
- Supports streaming and non-streaming
- Auto tool detection and execution
```

### Voice
```
POST /voice/synthesize    - Text to speech
POST /voice/transcribe    - Speech to text
GET  /voice/profile       - Get voice settings
POST /voice/profile       - Update voice settings
```

### Image
```
POST /image/generate      - Generate image from prompt
```

### RAG
```
POST /rag/upload          - Upload document for indexing
POST /rag/query           - Query indexed documents
```

### Admin
```
GET  /admin/billing       - Usage statistics
GET  /admin/memory        - Memory stats
GET  /admin/access        - Access logs
```

### Tools
```
GET  /tools/weather?location=...
GET  /tools/movies?query=...
GET  /tools/wiki?query=...
GET  /tools/dbpedia?query=...
GET  /tools/osm?query=...
GET  /tools/geoapify?address=...
GET  /tools/holidays?country=...&year=...
GET  /tools/fx?from=...&to=...&amount=...
GET  /tools/cars?vin=...
```

## Deploy

### Local
```bash
npm install
npm start
```

### Docker
```bash
docker build -t gptnix-backend .
docker run -p 8080:8080 --env-file .env gptnix-backend
```

### Cloud Run
```bash
# Option 1: Use deploy script
./deploy-gptnix.sh

# Option 2: Manual
gcloud builds submit --tag gcr.io/PROJECT_ID/gptnix-backend
gcloud run deploy gptnix-backend \
  --image gcr.io/PROJECT_ID/gptnix-backend \
  --region us-central1 \
  --platform managed \
  --memory 2Gi \
  --cpu 2
```

## Configuration

See `.env.example` for all configuration options.

### Essential
- Firebase credentials
- At least one LLM API key (DeepSeek or OpenAI)

### Optional
- Web search API keys (Tavily, Serper)
- Vector DB (Qdrant) for RAG
- External tool API keys (Weather, TMDb, etc.)
- Voice settings

## Architecture

```
src/
├── routes/          # API endpoints
├── services/        # Business logic
│   ├── websearch/   # Web search system
│   ├── providers/   # LLM providers
│   └── tools/       # External APIs
├── middleware/      # Auth, rate limiting
├── config/          # Environment, Firebase
├── billing/         # Cost tracking
├── utils/           # Helpers
└── clients/         # External clients (OpenAI, Replicate, Qdrant)
```

## Firestore Schema

```
conversations/{id}/
  user_id: string
  updated_at: Timestamp
  last_message: string
  title: string
  messages/{id}/
    role: "user" | "assistant"
    content: string
    created_at_ms: number
    usage: object
    tool_calls: array

memory/{user_id}/facts/{id}/
  fact: string
  embedding: array
  created_at: Timestamp

billing/{user_id}/usage/{date}/
  requests: number
  tokens: number
  cost_usd: number
```

## Billing

Tracks usage for:
- LLM API calls (token usage)
- Image generation (Replicate)
- Web search (API calls)
- Voice (TTS/STT minutes)

Cost estimation:
- DeepSeek: ~$0.001 per 1K tokens
- OpenAI GPT-4: ~$0.03 per 1K tokens
- Replicate images: ~$0.005 per image
- Web search: Free (DuckDuckGo) or $0.001 per search

## Performance

- Average latency: <500ms (simple queries)
- Streaming: First token <200ms
- Web search: +2-5s
- RAG: +100-300ms
- Image generation: 5-15s

## Troubleshooting

### Slow responses
- Check TTFB (time to first byte)
- Reduce MAX_HISTORY if needed
- Disable unused features

### High costs
- Use DeepSeek instead of OpenAI
- Limit MAX_TOKENS
- Disable web search for simple queries

### Memory errors
- Check Qdrant connection
- Verify embeddings API key
- Clear old vectors

## Support

Check the detailed documentation:
- `START_HERE.md` - Quick setup
- `DEPLOY.md` - Deployment guide
- `README_WEB_SEARCH_V2.md` - Web search docs
- `README_V5.1.1.md` - V5.1.1 release notes
- `CHANGELOG*.md` - Version history
