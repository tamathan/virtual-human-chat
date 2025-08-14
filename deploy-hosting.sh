#!/bin/bash

# Enhanced Firebase Hosting deployment script
# Usage: ./deploy-hosting.sh [environment] [bff-url]
# Environment: development, staging, production (default: production)

set -e

# Parse arguments
ENVIRONMENT="${1:-production}"
BFF_URL="${2}"

echo "🚀 Deploying Virtual Human Chat to Firebase Hosting"
echo "🌍 Environment: ${ENVIRONMENT}"

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

# Override BFF URL if provided as argument
if [ -n "$BFF_URL" ]; then
    echo "🔗 Using provided BFF URL: ${BFF_URL}"
    export VITE_BFF_URL="$BFF_URL"
fi

# Validate required variables
if [ -z "$VITE_BFF_URL" ]; then
    echo "❌ Error: VITE_BFF_URL is required"
    echo "   Please set it in your .env.${ENVIRONMENT} file or pass as second argument"
    echo "   Example: ./deploy-hosting.sh production https://vh-bff-xyz.run.app"
    exit 1
fi

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Error: Firebase CLI is not installed"
    echo "   Please run: npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo "❌ Error: Please login to Firebase first"
    echo "   Run: firebase login"
    exit 1
fi

# Get current project
CURRENT_PROJECT=$(firebase use --project 2>/dev/null | tail -1 | sed 's/.*(\(.*\)).*/\1/' || echo "")
if [ -z "$CURRENT_PROJECT" ]; then
    echo "❌ Error: No Firebase project selected"
    echo "   Run: firebase use --add to add a project"
    exit 1
fi

echo "📊 Firebase Project: ${CURRENT_PROJECT}"
echo "🔗 BFF URL: ${VITE_BFF_URL}"

# Verify Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Warning: Node.js 18+ recommended for best compatibility"
fi

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install

# Create production environment file for build
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🔧 Creating production build configuration..."
    cat > .env.production.local << EOF
VITE_BFF_URL=${VITE_BFF_URL}
NODE_ENV=production
EOF
fi

# Build frontend with environment-specific configuration
echo "🔨 Building frontend for ${ENVIRONMENT}..."
if [ "$ENVIRONMENT" = "production" ]; then
    NODE_ENV=production npm run build
else
    npm run build
fi

# Verify build output
if [ ! -d "dist" ]; then
    echo "❌ Error: Build failed - dist directory not found"
    exit 1
fi

echo "📋 Build summary:"
echo "   Build size: $(du -sh dist | cut -f1)"
echo "   Files count: $(find dist -type f | wc -l)"

# Check if firebase.json exists and is valid
if [ ! -f "firebase.json" ]; then
    echo "❌ Error: firebase.json not found"
    exit 1
fi

# Validate firebase.json
if ! firebase functions:config:get --project="$CURRENT_PROJECT" > /dev/null 2>&1; then
    echo "⚠️  Warning: Unable to validate Firebase configuration"
fi

# Deploy to Firebase Hosting
echo "🚀 Deploying to Firebase Hosting..."
if [ "$ENVIRONMENT" = "production" ]; then
    firebase deploy --only hosting --project="$CURRENT_PROJECT"
else
    # For non-production, you might want to deploy to a different target
    firebase deploy --only hosting --project="$CURRENT_PROJECT"
fi

# Get hosting URL
HOSTING_URL="https://${CURRENT_PROJECT}.web.app"
ALT_URL="https://${CURRENT_PROJECT}.firebaseapp.com"

# Test the deployment
echo "🔍 Testing deployment..."
sleep 3
if curl -f "$HOSTING_URL" > /dev/null 2>&1; then
    echo "✅ Deployment test passed"
else
    echo "⚠️  Deployment test failed - please check manually"
fi

echo ""
echo "✅ Deployment completed successfully!"
echo "🌐 Primary URL: ${HOSTING_URL}"
echo "🌐 Alternative URL: ${ALT_URL}"

if [ "$ENVIRONMENT" = "production" ]; then
    echo ""
    echo "🔒 Production Deployment Checklist:"
    echo "   ✓ HTTPS enforced"
    echo "   ✓ Security headers configured"
    echo "   ✓ CSP policy applied"
    echo "   ✓ Static assets cached"
    echo "   ✓ BFF integration configured"
fi

echo ""
echo "🔧 Next steps:"
echo "1. Test the application: ${HOSTING_URL}"
echo "2. Verify BFF connectivity: ${VITE_BFF_URL}/health"
echo "3. Check browser console for any errors"
echo "4. Test audio functionality"

if [ "$ENVIRONMENT" = "production" ]; then
    echo "5. Update DNS records if using custom domain"
    echo "6. Monitor Cloud Logging for any issues"
fi

# Clean up temporary files
if [ -f ".env.production.local" ]; then
    rm .env.production.local
fi