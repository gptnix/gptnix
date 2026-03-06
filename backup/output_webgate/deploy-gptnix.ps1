# GPTNiX V4.3 - Cloud Run Deployment Script (PowerShell)
# Usage: .\deploy-gptnix.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting GPTNiX V4.3 deployment..." -ForegroundColor Green

# Configuration
$PROJECT_ID = "gptnix-backend-440718"  # Zamijeni sa svojim project ID-om
$SERVICE_NAME = "gptnix-backend"
$REGION = "us-central1"

# Step 1: Deploy to Cloud Run
Write-Host "📦 Deploying to Cloud Run..." -ForegroundColor Yellow

gcloud run deploy $SERVICE_NAME `
  --source . `
  --region $REGION `
  --clear-base-image `
  --platform managed `
  --allow-unauthenticated `
  --memory 1Gi `
  --cpu 1 `
  --timeout 300s `
  --min-instances 1 `
  --max-instances 10 `
  --port 8080

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}

# Step 2: Set environment variables (ako postoje)
if (Test-Path ".env") {
    Write-Host "🔧 Setting environment variables..." -ForegroundColor Yellow
    
    # Read .env and convert to comma-separated format
    $envVars = Get-Content .env | Where-Object { $_ -notmatch '^#' -and $_ -match '\S' } | ForEach-Object { $_.Trim() }
    $ENV_VARS = $envVars -join ","
    
    if ($ENV_VARS) {
        gcloud run services update $SERVICE_NAME `
          --region $REGION `
          --update-env-vars "$ENV_VARS"
    }
} else {
    Write-Host "⚠️  No .env file found. Skipping environment variables." -ForegroundColor Yellow
}

# Step 3: Get service URL
Write-Host "✅ Deployment complete!" -ForegroundColor Green
$SERVICE_URL = gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)'

Write-Host ""
Write-Host "🌐 Service URL: $SERVICE_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host "🧪 Test endpoints:" -ForegroundColor Yellow
Write-Host "   Health:  curl $SERVICE_URL/health"
Write-Host "   Chat:    curl -X POST $SERVICE_URL/chat -H 'Content-Type: application/json' -d '{`"message`":`"Bok!`"}'"
Write-Host ""
Write-Host "🎉 Done!" -ForegroundColor Green
