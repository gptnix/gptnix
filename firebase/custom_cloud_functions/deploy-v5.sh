#!/bin/bash
# deploy-v5.sh - Automated deployment script for GPTNiX Backend V5

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
SERVICE_NAME="${SERVICE_NAME:-gptnix-backend}"
REGION="${REGION:-us-central1}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:v5-latest"
MIN_INSTANCES="${MIN_INSTANCES:-1}"
MAX_INSTANCES="${MAX_INSTANCES:-10}"
MEMORY="${MEMORY:-2Gi}"
CPU="${CPU:-2}"
CONCURRENCY="${CONCURRENCY:-80}"
TIMEOUT="${TIMEOUT:-300s}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      GPTNiX Backend V5 - Deployment Script           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if required commands exist
command -v gcloud >/dev/null 2>&1 || { echo -e "${RED}❌ gcloud CLI not found. Install it first.${NC}" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo -e "${RED}❌ docker not found. Install it first.${NC}" >&2; exit 1; }

# Confirm configuration
echo -e "${YELLOW}📋 Deployment Configuration:${NC}"
echo "   Project ID: $PROJECT_ID"
echo "   Service: $SERVICE_NAME"
echo "   Region: $REGION"
echo "   Memory: $MEMORY"
echo "   CPU: $CPU"
echo "   Instances: $MIN_INSTANCES - $MAX_INSTANCES"
echo ""
read -p "Continue with deployment? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

# Step 1: Build Docker image
echo ""
echo -e "${BLUE}🔨 Step 1/4: Building Docker image...${NC}"
docker build -t ${IMAGE} . || {
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
}
echo -e "${GREEN}✅ Image built successfully${NC}"

# Step 2: Push to Container Registry
echo ""
echo -e "${BLUE}📦 Step 2/4: Pushing image to GCR...${NC}"
docker push ${IMAGE} || {
    echo -e "${RED}❌ Image push failed${NC}"
    exit 1
}
echo -e "${GREEN}✅ Image pushed successfully${NC}"

# Step 3: Deploy to Cloud Run
echo ""
echo -e "${BLUE}☁️  Step 3/4: Deploying to Cloud Run...${NC}"
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory ${MEMORY} \
  --cpu ${CPU} \
  --timeout ${TIMEOUT} \
  --concurrency ${CONCURRENCY} \
  --min-instances ${MIN_INSTANCES} \
  --max-instances ${MAX_INSTANCES} \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "DEEPSEEK_API_KEY=deepseek-key:latest,OPENAI_API_KEY=openai-key:latest,QDRANT_API_KEY=qdrant-key:latest,QDRANT_URL=qdrant-url:latest" \
  --project ${PROJECT_ID} || {
    echo -e "${RED}❌ Cloud Run deployment failed${NC}"
    exit 1
}
echo -e "${GREEN}✅ Deployed to Cloud Run${NC}"

# Step 4: Get service URL
echo ""
echo -e "${BLUE}🔍 Step 4/4: Getting service URL...${NC}"
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --format 'value(status.url)' \
  --project ${PROJECT_ID})

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Deployment Successful! 🎉                   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 Service URL:${NC} $SERVICE_URL"
echo ""

# Health check
echo -e "${BLUE}🏥 Running health check...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" ${SERVICE_URL}/health)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed (HTTP 200)${NC}"
else
    echo -e "${YELLOW}⚠️  Health check returned HTTP ${HTTP_CODE}${NC}"
fi

# Show useful commands
echo ""
echo -e "${YELLOW}📚 Useful commands:${NC}"
echo ""
echo "  # View logs"
echo "  gcloud run services logs read ${SERVICE_NAME} --region ${REGION} --project ${PROJECT_ID}"
echo ""
echo "  # Check health"
echo "  curl ${SERVICE_URL}/health"
echo ""
echo "  # Monitor circuit breakers"
echo "  curl ${SERVICE_URL}/admin/circuit-breakers"
echo ""
echo "  # Check memory"
echo "  curl ${SERVICE_URL}/admin/memory"
echo ""
echo -e "${GREEN}🚀 Deployment complete!${NC}"
