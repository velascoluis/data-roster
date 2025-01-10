#!/bin/bash


# Check if arguments are provided
if [ $# -ne 2 ]; then
    echo "Usage: $0 <project_id> <region>"
    exit 1
fi

PROJECT_ID=$1
REGION=$2
SERVICE_NAME="data-roster"
REPOSITORY="data-roster"

echo "🔧 Starting deployment process..."

# Create Artifact Registry repository if it doesn't exist
echo "📦 Ensuring Artifact Registry repository exists..."
if ! gcloud artifacts repositories describe ${REPOSITORY} \
    --location=${REGION} \
    --project=${PROJECT_ID} > /dev/null 2>&1; then
    echo "Creating repository ${REPOSITORY}..."
    gcloud artifacts repositories create ${REPOSITORY} \
        --repository-format=docker \
        --location=${REGION} \
        --project=${PROJECT_ID} \
        --description="Repository for Data Roster images"
fi

# Configure Docker to use Artifact Registry
echo "🔑 Configuring Docker authentication..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build and push the image
echo "🏗️ Building and pushing image..."
IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/app"
gcloud builds submit --tag ${IMAGE_URL}

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_URL} \
    --platform managed \
    --region ${REGION} \
    --project ${PROJECT_ID} \
    --allow-unauthenticated

# Verify deployment
echo "🔍 Verifying deployment..."
REVISION_NAME=$(gcloud run revisions list \
    --service=${SERVICE_NAME} \
    --region=${REGION} \
    --project=${PROJECT_ID} \
    --format='value(name)' \
    --limit=1)

# Check revision status
STATUS=$(gcloud run revisions describe ${REVISION_NAME} \
    --region=${REGION} \
    --project=${PROJECT_ID} \
    --format='value(status.conditions[0].status)')

if [ "$STATUS" != "True" ]; then
    echo "❌ Deployment failed. Checking logs..."
    gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=${SERVICE_NAME} AND resource.labels.revision_name=${REVISION_NAME}" \
        --project=${PROJECT_ID} \
        --format='value(textPayload)' \
        --limit=50
fi

echo "✅ Deployment completed successfully!"
echo "🌐 Service URL:"
gcloud run services describe ${SERVICE_NAME} \
    --platform managed \
    --region ${REGION} \
    --project ${PROJECT_ID} \
    --format 'value(status.url)'
