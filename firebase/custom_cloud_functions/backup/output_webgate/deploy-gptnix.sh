#!/bin/bash

# GPTNiX V4.3 - Cloud Run Deployment Script
# Usage: ./deploy-gptnix.sh

set -e  # Exit on error

echo "🚀 Starting GPTNiX V4.3 deployment..."

# Configuration
PROJECT_ID="gptnix-backend-440718"  # Zamijeni sa svojim project ID-om
SERVICE_NAME="gptnix-backend"
REGION="us-central1"

# Step 1: Deploy to Cloud Run
echo "📦 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --clear-base-image \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300s \
  --min-instances 1 \
  --max-instances 10 \
  --port 8080

# Step 2: Set environment variables (ako postoje)
if [ -f ".env" ]; then
  echo "🔧 Setting environment variables..."
  
  # Read .env and convert to comma-separated format
  ENV_VARS=$(cat .env | grep -v '^#' | grep -v '^$' | tr '\n' ',' | sed 's/,$//')
  
  if [ ! -z "$ENV_VARS" ]; then
    gcloud run services update $SERVICE_NAME \
      --region $REGION \
      --update-env-vars "$ENV_VARS"
  fi
else
  echo "⚠️  No .env file found. Skipping environment variables."
fi

# Step 3: Get service URL
echo "✅ Deployment complete!"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')

echo ""
echo "🌐 Service URL: $SERVICE_URL"
echo ""
echo "🧪 Test endpoints:"
echo "   Health:  curl $SERVICE_URL/health"
echo "   Chat:    curl -X POST $SERVICE_URL/chat -H 'Content-Type: application/json' -d '{\"message\":\"Bok!\"}'"
echo ""
echo "🎉 Done!"
