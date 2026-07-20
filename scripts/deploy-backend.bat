@echo off
REM ============================================================
REM  deploy-backend.bat
REM  Builds and deploys the DocMind AI backend to Cloud Run
REM  Usage: scripts\deploy-backend.bat
REM ============================================================

SET PROJECT_ID=docmind-ai-501117
SET REGION=us-central1
SET SERVICE=docmind-backend
SET IMAGE=gcr.io/%PROJECT_ID%/%SERVICE%

echo.
echo [1/4] Setting active project...
gcloud config set project %PROJECT_ID%

echo.
echo [2/4] Building backend Docker image via Cloud Build...
gcloud builds submit backend ^
  --tag %IMAGE% ^
  --project %PROJECT_ID%

IF %ERRORLEVEL% NEQ 0 (
  echo ERROR: Cloud Build failed. Aborting.
  exit /b 1
)

echo.
echo [3/4] Deploying to Cloud Run...
gcloud run deploy %SERVICE% ^
  --image %IMAGE% ^
  --platform managed ^
  --region %REGION% ^
  --allow-unauthenticated ^
  --memory 1Gi ^
  --cpu 1 ^
  --timeout 300 ^
  --concurrency 10 ^
  --min-instances 0 ^
  --max-instances 3 ^
  --set-env-vars "CHROMA_PERSIST_DIR=/data/chroma_db,USE_LOCAL_MODELS=true" ^
  --project %PROJECT_ID%

IF %ERRORLEVEL% NEQ 0 (
  echo ERROR: Cloud Run deploy failed.
  exit /b 1
)

echo.
echo [4/4] Fetching deployed service URL...
gcloud run services describe %SERVICE% ^
  --platform managed ^
  --region %REGION% ^
  --format "value(status.url)" ^
  --project %PROJECT_ID%

echo.
echo Backend deploy complete!
