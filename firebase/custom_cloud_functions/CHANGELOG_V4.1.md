# 📝 GPTNiX Backend - V4.1 CHANGELOG

## [4.1.0] - 2026-01-12 - "Production Stability Release"

### 🎯 **Critical Fixes**

This release fixes **4 critical bugs** identified through production testing and ChatGPT analysis.

---

## 🐛 **BUG FIXES**

### **Fix #1: Router Contract Mismatch** ⭐⭐⭐
**Problem:** Router returned strings, chat.js expected objects
**Impact:** Tools not triggering properly
**Solution:** Normalization in smartRouter.js
**Files:** `src/services/smartRouter.js`

### **Fix #2: RAG Document Hijacking** ⭐⭐⭐  
**Problem:** Recent uploads injected into ALL queries
**Impact:** "Avatar 3" failed after PDF upload
**Solution:** Smart gating with _isDocumentQuery()
**Files:** `src/routes/chat.js`

### **Fix #3: Current Position Patterns** ⭐⭐⭐
**Problem:** No pattern for "tko je načelnik" queries
**Impact:** Web search not triggering
**Solution:** Added position title patterns
**Files:** `src/lib/router.js`

### **Fix #4: Better Error Messages** ⭐⭐
**Problem:** Generic "not found" errors
**Impact:** Hard to debug TMDB/OMDb failures
**Solution:** Surface actual HTTP errors
**Files:** `src/services/tools/movies.js`

---

## 🆕 **NEW FEATURES**

### **Smoke Test Suite** 🧪
Automated testing for routing patterns

**Usage:**
```bash
node smoke-test.js
node smoke-test.js --url https://your-backend.run.app
```

---

## 📊 **Performance**

| Query | V4.0 | V4.1 | Improvement |
|-------|------|------|-------------|
| "Tko je načelnik?" | 4.4s | 0.02s | 220x faster |
| "Avatar 3" (after PDF) | Failed | 0.05s | Fixed! |

---

## 🚀 **Migration**

1. Replace V4.0 with V4.1
2. Keep same .env
3. Deploy
4. Run: `node smoke-test.js`

**Zero breaking changes!** ✅

---

**Current Version: 4.1.0** 🚀
