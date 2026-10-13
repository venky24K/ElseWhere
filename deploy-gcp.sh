#!/usr/bin/env bash
set -e

# ========================================================
# ElseWhere (Latexer) - Google Cloud Run Deployment Script
# ========================================================

PROJECT_ID="${GCP_PROJECT_ID:-elsewhere-511504}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="elsewhere"

echo "========================================================"
echo "🚀 Deploying ElseWhere to Google Cloud Run"
echo "Project ID : ${PROJECT_ID}"
echo "Region     : ${REGION}"
echo "Service    : ${SERVICE_NAME}"
echo "========================================================"

# 1. Ensure gcloud is authenticated
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: Google Cloud SDK (gcloud) is not installed."
    echo "Install it via: brew install google-cloud-sdk"
    exit 1
fi

# 2. Set current project
echo "⚙️  Setting active GCP project to ${PROJECT_ID}..."
gcloud config set project "${PROJECT_ID}"

# 3. Enable required Google Cloud APIs
echo "🔌 Enabling required GCP service APIs (Cloud Run, Cloud Build, Artifact Registry)..."
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    containerregistry.googleapis.com \
    --project="${PROJECT_ID}"

# 4. Deploy directly from source to Cloud Run
# Cloud Run will use Google Cloud Build to package the Dockerfile in the cloud (no local Docker needed!)
echo "📦 Building container on Cloud Build & Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
    --source . \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --platform=managed \
    --allow-unauthenticated \
    --memory=2Gi \
    --cpu=2 \
    --timeout=300s \
    --set-env-vars="NODE_ENV=production"

echo ""
echo "🎉 Deployment Complete!"
echo "Your live ElseWhere app URL:"
gcloud run services describe "${SERVICE_NAME}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --format='value(status.url)'
