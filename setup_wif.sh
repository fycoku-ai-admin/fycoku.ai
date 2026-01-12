#!/bin/bash
set -e

# Configuration Variables
# Replace these with your values if not running interactively
# GCP_PROJECT_ID="your-project-id"
GITHUB_REPO="fycoku/fycoku.ai" # Format: username/repo

# Check if GCP_PROJECT_ID is set
if [ -z "$GCP_PROJECT_ID" ]; then
    echo "Please enter your Google Cloud Project ID:"
    read GCP_PROJECT_ID
fi

echo "Setting up Workload Identity Federation for Project: $GCP_PROJECT_ID"
echo "GitHub Repo: $GITHUB_REPO"

# Set default project
gcloud config set project "$GCP_PROJECT_ID"

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable iam.googleapis.com \
    cloudresourcemanager.googleapis.com \
    iamcredentials.googleapis.com \
    sts.googleapis.com

# Create a Service Account
SA_NAME="github-actions-sa"
SA_EMAIL="$SA_NAME@$GCP_PROJECT_ID.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe "$SA_EMAIL" > /dev/null 2>&1; then
    echo "Creating Service Account: $SA_NAME..."
    gcloud iam service-accounts create "$SA_NAME" \
        --display-name="GitHub Actions Service Account"
else
    echo "Service Account $SA_NAME already exists."
fi

# Create Workload Identity Pool
POOL_NAME="github-pool"
# Check if pool exists (simple check by listing, might fail if specific error, but good enough for script)
if ! gcloud iam workload-identity-pools describe "$POOL_NAME" --location="global" > /dev/null 2>&1; then
    echo "Creating Workload Identity Pool: $POOL_NAME..."
    gcloud iam workload-identity-pools create "$POOL_NAME" \
        --location="global" \
        --display-name="GitHub Actions Pool"
else
    echo "Workload Identity Pool $POOL_NAME already exists."
fi

POOL_ID=$(gcloud iam workload-identity-pools describe "$POOL_NAME" \
  --location="global" \
  --format="value(name)")

# Create Workload Identity Provider
PROVIDER_NAME="github-provider"
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_NAME" \
    --location="global" \
    --workload-identity-pool="$POOL_NAME" > /dev/null 2>&1; then
    
    echo "Creating Workload Identity Provider: $PROVIDER_NAME..."
    gcloud iam workload-identity-pools providers create "$PROVIDER_NAME" \
        --location="global" \
        --workload-identity-pool="$POOL_NAME" \
        --display-name="GitHub Actions Provider" \
        --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
        --issuer-uri="https://token.actions.githubusercontent.com"
else
    echo "Workload Identity Provider $PROVIDER_NAME already exists."
fi

PROVIDER_ID=$(gcloud iam workload-identity-pools providers describe "$PROVIDER_NAME" \
  --location="global" \
  --workload-identity-pool="$POOL_NAME" \
  --format="value(name)")

# Bind Service Account to Workload Identity Pool (for this specific repo)
echo "binding policy..."
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/${POOL_ID}/attribute.repository/${GITHUB_REPO}"


echo "--------------------------------------------------------"
echo "SETUP COMPLETE!"
echo "--------------------------------------------------------"
echo "Add the following secrets to your GitHub Repository ($GITHUB_REPO):"
echo ""
echo "GCP_PROJECT_ID: $GCP_PROJECT_ID"
echo "GCP_WIF_PROVIDER: $PROVIDER_ID"
echo "GCP_SA_EMAIL: $SA_EMAIL"
echo "--------------------------------------------------------"
