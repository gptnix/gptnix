# Auto Title Generation Feature

## 🎯 Overview

GPTNiX backend now automatically generates smart conversation titles using GPT-4o-mini!

**Before:**
```
- "New Chat"
- "New Chat"
- "New Chat"
```

**After:**
```
- "Pizza Recipe Help"
- "Python Bug Fix"
- "Travel to Japan"
```

---

## ✅ What's New

### New Service: `titleGenerator.js`

Located: `src/services/titleGenerator.js`

**Functions:**
- `shouldGenerateTitle(convData)` - Checks if title generation is needed
- `generateConversationTitle(conversationId, userMessage, assistantMessage)` - Generates title using GPT-4o-mini
- `scheduleTitleGeneration({ conversationId, userMessage, assistantMessage })` - Fire-and-forget scheduler

### Integration Points

Modified: `src/routes/chat/handler.js`

**4 locations where title generation is scheduled:**
1. After non-streaming response (line ~3180)
2. After pseudo-stream response (line ~3445)
3. After OpenAI stream response (line ~3490)
4. After DeepSeek stream response (line ~3570)

---

## 🚀 How It Works

### Flow Diagram

```
User sends message
      ↓
Backend processes
      ↓
AI responds
      ↓
Save to Firestore
  message_count: 2
      ↓
Schedule title generation (fire-and-forget)
      ↓
Check: shouldGenerateTitle?
  ┌─────┴─────┐
  YES         NO
  ↓           ↓
Generate    Skip
  ↓
GPT-4o-mini call
  ↓
"Pizza Recipe"
  ↓
Update Firestore:
  title: "Pizza Recipe"
  title_is_manual: false
  title_generated_at: timestamp
```

### When Title is Generated

```
✅ message_count ≤ 4 (first few messages)
✅ title is empty or "New Chat"
✅ title_is_manual = false
❌ message_count > 4 (too late)
❌ title_is_manual = true (user set it)
```

---

## 💰 Cost

**GPT-4o-mini pricing:**
- Input: $0.150 / 1M tokens
- Output: $0.600 / 1M tokens

**Per conversation:**
- Input: ~150 tokens (prompt + messages)
- Output: ~10 tokens (title)
- **Cost: ~$0.000028 per title**

**Monthly cost examples:**
```
1,000 chats/month:   $0.03
10,000 chats/month:  $0.28
100,000 chats/month: $2.80
```

**Practically free!** ✅

---

## 🔧 Configuration

No configuration needed! Works out of the box.

**Requirements:**
- `OPENAI_API_KEY` environment variable (already configured)
- Firestore enabled (already configured)
- `firebase-admin` package (already installed)

---

## 📊 Firestore Schema

**Updated `conversations` collection:**

```javascript
{
  title: 'Pizza Recipe Help',
  title_is_manual: false,        // true = user set manually
  title_generated_at: Timestamp, // when title was auto-generated
  message_count: 2,
  // ... other fields
}
```

---

## 🧪 Testing

### Test Locally

```bash
# Start backend
npm start

# Send a message (use your API)
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "test123",
    "userId": "user456",
    "message": "How to make pizza dough?"
  }'

# Check Firestore
# conversations/test123/title should be auto-generated
```

### Expected Behavior

1. **First message:**
   - Title: "" (empty)
   
2. **After AI responds:**
   - Title generation scheduled
   - ~2-3 seconds delay
   - Title: "Pizza Dough Recipe" ✅

3. **User manually renames:**
   - Sets `title_is_manual: true`
   - Future messages won't override

---

## 🐛 Error Handling

Title generation is **non-critical** and **fire-and-forget**:

- If GPT-4o-mini fails → Logged, chat continues normally
- If Firestore fails → Logged, chat continues normally
- If title too short → Uses fallback: "Chat [date]"
- If network timeout → Logged, chat continues normally

**Chat functionality is never blocked by title generation!**

---

## 📝 Code Examples

### Manual Title Generation (if needed)

```javascript
const { generateConversationTitle } = require('./src/services/titleGenerator');

const title = await generateConversationTitle(
  'conv123',
  'How to make pizza?',
  'Here is a simple recipe...'
);

console.log('Generated:', title);
// Output: "Pizza Recipe Help"
```

### Check if Title Needed

```javascript
const { shouldGenerateTitle } = require('./src/services/titleGenerator');

const convData = {
  message_count: 2,
  title: '',
  title_is_manual: false,
};

const needed = shouldGenerateTitle(convData);
// Output: true
```

---

## 🎉 Benefits

| Metric | Before | After |
|--------|--------|-------|
| Chat recognition | Hard | Instant ✅ |
| Finding old chats | Manual search | Quick scan ✅ |
| User experience | Generic | Professional ✅ |
| Drawer appearance | Cluttered | Clean ✅ |
| Cost | $0 | $0.03/month ✅ |

---

## 🔍 Logs to Watch

```
[TITLE_GEN] Will generate: title is empty or generic
[TITLE_GEN] Generating title for conversation: conv123
✅ [TITLE_GEN] Generated title for conv123: "Pizza Recipe Help"
```

**Or if skipped:**
```
[TITLE_GEN] Skipping: title is manual
[TITLE_GEN] Skipping: message_count too high: 10
[TITLE_GEN] Skipping: already has good title: My Project
```

---

## 🚀 Deployment

Already integrated! No action needed.

Just deploy as usual:

```bash
# Deploy to Cloud Run
./deploy-v5.sh
```

Title generation will start working automatically for all new conversations!

---

## 📈 Future Enhancements (Optional)

### Multi-language Optimization

Currently detects language automatically (GPT-4o-mini is multilingual).

Could add explicit language hint:

```javascript
const titlePrompt = `Generate title in ${languageHint} language...`;
```

### Title Regeneration

Add API endpoint to regenerate title on demand:

```javascript
POST /api/conversations/:id/regenerate-title
```

### Title Templates

Customize title format by category:

```javascript
// Code: "Bug: [description]"
// Recipe: "Recipe: [dish]"
// Travel: "Trip to [location]"
```

But current implementation already works great! ✅

---

## 🎯 Summary

**What changed:**
- 1 new file: `src/services/titleGenerator.js`
- 1 modified file: `src/routes/chat/handler.js` (4 integration points)

**Impact:**
- Zero breaking changes
- Zero config needed
- Zero user action required
- Automatic smart titles
- Practically free

**Status:** ✅ Production Ready!

---

Generated: 2026-02-18
Backend Version: v5.2.2 + Auto Title Generation
