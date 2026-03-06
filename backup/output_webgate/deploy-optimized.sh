#!/bin/bash

##############################################################################
# GPTNiX Backend - OPTIMIZED DEPLOYMENT (Cost-Reduced)
#
# CHANGES FROM STANDARD DEPLOYMENT:
# - Memory: 2Gi → 512Mi (75% reduction)
# - CPU: 2 → 1 (50% reduction)
# - Timeout: 300s → 120s
# - Min instances: (not set) → 0 (no warm instances)
# - Max instances: 10 → 3
# - Background processes: DISABLED
# - Memory extraction: DISABLED
# - Thread summary: DISABLED
#
# EXPECTED SAVINGS: $47/month (67% reduction)
# NEW COST: ~$23/month (acceptable for DEV)
##############################################################################

set -e

echo "🚀 Deploying GPTNiX Backend - OPTIMIZED (Cost-Reduced)"
echo ""
echo "📊 Configuration:"
echo "  - Memory: 512Mi (was 2Gi)"
echo "  - CPU: 1 (was 2)"
echo "  - Timeout: 120s (was 300s)"
echo "  - Min instances: 0 (no warm instances)"
echo "  - Max instances: 3"
echo "  - Background Assistant: DISABLED"
echo "  - Memory Extraction: DISABLED"
echo "  - Thread Summary: DISABLED"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo "⏳ Deploying to Cloud Run..."
echo ""

# Deploy with optimized settings
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
  --concurrency 80 \
  --cpu-throttling \
  --set-env-vars "\
BACKGROUND_ASSISTANT_ENABLED=false,\
MEMORY_EXTRACT_PROVIDER=none,\
THREAD_SUMMARY_ENABLED=false"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Cost optimization summary:"
echo "  ✅ Memory reduced: 2Gi → 512Mi (-75%)"
echo "  ✅ CPU reduced: 2 → 1 (-50%)"
echo "  ✅ Timeout reduced: 300s → 120s (-60%)"
echo "  ✅ Min instances: 0 (no idle costs)"
echo "  ✅ Background processes: DISABLED"
echo ""
echo "💰 Expected savings: $47/month (67% reduction)"
echo "💰 New monthly cost: ~$23 (was ~$70)"
echo ""
echo "📈 Monitor costs:"
echo "  gcloud billing accounts list"
echo "  https://console.cloud.google.com/billing"
echo ""
echo "📊 Monitor performance:"
echo "  gcloud run logs read gptnix-backend --region us-central1 --limit 50"
echo ""
echo "⚠️  NOTE: First request will be slower (cold start)"
echo "    This is NORMAL with min-instances=0"
echo ""
