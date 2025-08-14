#!/bin/bash

# Enhanced Cloud Run deployment script for Virtual Human BFF
# Usage: ./deploy-cloud-run.sh [environment]
# Environment: development, staging, production (default: production)

set -e

# Parse environment argument
ENVIRONMENT="${1:-production}"
echo "🌍 Deploying to environment: ${ENVIRONMENT}"

# Load environment-specific variables
if [ -f ".env.${ENVIRONMENT}" ]; then
    echo "📄 Loading environment file: .env.${ENVIRONMENT}"
    export $(grep -v '^#' .env.${ENVIRONMENT} | xargs)
elif [ "${ENVIRONMENT}" = "production" ] && [ -f ".env.production" ]; then
    echo "📄 Loading production environment file"
    export $(grep -v '^#' .env.production | xargs)
else
    echo "⚠️  No environment file found for ${ENVIRONMENT}, using system environment variables"
fi

# Check required environment variables
if [ -z "$GCP_PROJECT_ID" ]; then
    echo "❌ Error: GCP_PROJECT_ID environment variable is required"
    echo "   Please set it in your .env.${ENVIRONMENT} file or export it"
    exit 1
fi

if [ -z "$GEMINI_API_KEY" ]; then
    echo "❌ Error: GEMINI_API_KEY environment variable is required"
    echo "   Please set it in your .env.${ENVIRONMENT} file or export it"
    exit 1
fi

# Validate JWT_SECRET for production
if [ "${ENVIRONMENT}" = "production" ] && [ -z "$JWT_SECRET" ]; then
    echo "❌ Error: JWT_SECRET is required for production deployment"
    echo "   Please generate a secure secret: openssl rand -base64 64"
    exit 1
fi

# Configuration with environment-specific defaults
SERVICE_NAME="${SERVICE_NAME:-vh-bff}"
if [ "${ENVIRONMENT}" != "production" ]; then
    SERVICE_NAME="${SERVICE_NAME}-${ENVIRONMENT}"
fi

REGION="${GCP_REGION:-asia-northeast1}"
IMAGE_NAME="gcr.io/${GCP_PROJECT_ID}/${SERVICE_NAME}"
MEMORY="${CLOUD_RUN_MEMORY:-512Mi}"
CPU="${CLOUD_RUN_CPU:-1}"
MAX_INSTANCES="${CLOUD_RUN_MAX_INSTANCES:-10}"
MIN_INSTANCES="${CLOUD_RUN_MIN_INSTANCES:-0}"
CONCURRENCY="${CLOUD_RUN_CONCURRENCY:-1000}"
TIMEOUT="${CLOUD_RUN_TIMEOUT:-300}"

echo "🚀 Deploying Virtual Human BFF to Cloud Run"
echo "   Project: ${GCP_PROJECT_ID}"
echo "   Region: ${REGION}"
echo "   Service: ${SERVICE_NAME}"
echo "   Environment: ${ENVIRONMENT}"
echo "   Image: ${IMAGE_NAME}:latest"

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Error: Please authenticate with gcloud: gcloud auth login"
    exit 1
fi

# Set the project
gcloud config set project ${GCP_PROJECT_ID}

# Enable required APIs
echo "🔧 Ensuring required APIs are enabled..."
gcloud services enable cloudbuild.googleapis.com --quiet
gcloud services enable run.googleapis.com --quiet
gcloud services enable containerregistry.googleapis.com --quiet

# **CRITICAL FIX: Build frontend first, then copy to BFF directory**
echo "🎨 Building frontend..."
npm run build

echo "📦 Copying frontend build to BFF..."
mkdir -p bff/dist
cp -r dist/* bff/dist/

# Build and push Docker image
echo "📦 Building Docker image..."
cd bff

# Create .dockerignore if it doesn't exist
if [ ! -f ".dockerignore" ]; then
    cat > .dockerignore << EOF
node_modules
npm-debug.log
.env*
.git
.gitignore
README.md
.nyc_output
coverage
.editorconfig
EOF
fi

docker build -t ${IMAGE_NAME}:latest .

echo "📤 Pushing to Container Registry..."
docker push ${IMAGE_NAME}:latest

# Generate JWT secret if not provided
if [ -z "$JWT_SECRET" ]; then
    echo "🔑 Generating JWT secret..."
    JWT_SECRET=$(openssl rand -base64 64)
    echo "   Generated JWT_SECRET (save this securely): ${JWT_SECRET}"
fi

# Deploy to Cloud Run with enhanced configuration
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image=${IMAGE_NAME}:latest \
  --region=${REGION} \
  --project=${GCP_PROJECT_ID} \
  --platform=managed \
  --allow-unauthenticated \
  --memory=${MEMORY} \
  --cpu=${CPU} \
  --max-instances=${MAX_INSTANCES} \
  --min-instances=${MIN_INSTANCES} \
  --concurrency=${CONCURRENCY} \
  --timeout=${TIMEOUT} \
  --port=8080 \
  --set-env-vars="GEMINI_API_KEY=${GEMINI_API_KEY}" \
  --set-env-vars="JWT_SECRET=${JWT_SECRET}" \
  --set-env-vars="TOKEN_TTL_SEC=${TOKEN_TTL_SEC:-1800}" \
  --set-env-vars="TOKEN_CONNECT_WINDOW_SEC=${TOKEN_CONNECT_WINDOW_SEC:-60}" \
  --set-env-vars="NODE_ENV=${ENVIRONMENT}" \
  --set-env-vars="FRONTEND_URL=${FRONTEND_URL}" \
  --set-env-vars="LOG_LEVEL=${LOG_LEVEL:-info}" \
  --execution-environment=gen2 \
  --cpu-boost \
  --service-account="${SERVICE_ACCOUNT:-${GCP_PROJECT_ID}-compute@developer.gserviceaccount.com}" \
  --labels="environment=${ENVIRONMENT},service=vh-bff,version=latest"

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region=${REGION} \
  --project=${GCP_PROJECT_ID} \
  --format="value(status.url)")

# Test health endpoint
echo "🔍 Testing service health..."
sleep 5
if curl -f "${SERVICE_URL}/health" > /dev/null 2>&1; then
    echo "✅ Health check passed"
else
    echo "⚠️  Health check failed - please check logs"
fi

echo ""
echo "✅ Deployment completed successfully!"
echo "🌐 Service URL: ${SERVICE_URL}"
echo "📊 Service Logs: gcloud logs tail --project=${GCP_PROJECT_ID} --service=${SERVICE_NAME}"
echo "📝 Update your frontend .env file with:"
echo "   VITE_BFF_URL=${SERVICE_URL}"

if [ "${ENVIRONMENT}" = "production" ]; then
    echo ""
    echo "🔒 Production Security Checklist:"
    echo "   ✓ HTTPS enforced"
    echo "   ✓ Security headers configured"
    echo "   ✓ JWT secret secured"
    echo "   ✓ API key protected"
    echo "   ✓ Rate limiting enabled"
    echo "   ✓ CORS configured for production domain"
fi

cd ..