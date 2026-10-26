#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${BACKEND_DIR}/.env.deploy"

echo "=================================================================="
echo " 🚀 Despliegue del Backend en Google Cloud Run"
echo "=================================================================="

if ! command -v gcloud >/dev/null 2>&1; then
  echo "❌ Error: No se encontró el comando 'gcloud'."
  echo "   Instala Google Cloud SDK desde: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

if [[ -f "${ENV_FILE}" ]]; then
  echo "📄 Cargando configuración desde ${ENV_FILE}..."
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
else
  echo "⚠️  Aviso: No existe ${ENV_FILE}."
  echo "   Puedes crearlo ejecutando: cp backend/.env.deploy.example backend/.env.deploy"
fi

GCP_PROJECT_ID="${GCP_PROJECT_ID:-}"
GCP_REGION="${GCP_REGION:-europe-southwest1}"
SERVICE_NAME="${SERVICE_NAME:-ies-orienteering-api}"
INITIAL_ADMIN_EMAIL="${INITIAL_ADMIN_EMAIL:-}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-https://julioyg.github.io}"
CONTROLS_SECRET_SEED="${CONTROLS_SECRET_SEED:-}"

if [[ -z "${GCP_PROJECT_ID}" || "${GCP_PROJECT_ID}" == "tu-proyecto-gcp" ]]; then
  read -r -p "👉 Introduce tu GCP_PROJECT_ID: " GCP_PROJECT_ID
fi

if [[ -z "${INITIAL_ADMIN_EMAIL}" ]]; then
  read -r -p "👉 Introduce el email del profesor administrador inicial (INITIAL_ADMIN_EMAIL): " INITIAL_ADMIN_EMAIL
fi

if [[ -z "${GOOGLE_CLIENT_ID}" || "${GOOGLE_CLIENT_ID}" == "tu-client-id.apps.googleusercontent.com" ]]; then
  read -r -p "👉 Introduce tu GOOGLE_CLIENT_ID (OAuth 2.0 Web Client ID): " GOOGLE_CLIENT_ID
fi

if [[ -z "${CONTROLS_SECRET_SEED}" || "${CONTROLS_SECRET_SEED}" == "reemplaza-con-una-semilla-secreta-hexadecimal-de-64-caracteres" ]]; then
  read -r -p "👉 Introduce tu CONTROLS_SECRET_SEED (semilla secreta de balizas): " CONTROLS_SECRET_SEED
fi

cd "${BACKEND_DIR}"

echo "🧪 1/3 Ejecutando tests unitarios y de integración (Clean Architecture)..."
npm test

echo "🔨 2/3 Verificando compilación TypeScript..."
npm run build

echo "☁️  3/3 Desplegando servicio '${SERVICE_NAME}' en Cloud Run (${GCP_REGION})..."
gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --project "${GCP_PROJECT_ID}" \
  --region "${GCP_REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 256Mi \
  --max-instances 2 \
  --set-env-vars="NODE_ENV=production,DB_PROVIDER=firestore,ALLOW_DEV_AUTH=false,INITIAL_ADMIN_EMAIL=${INITIAL_ADMIN_EMAIL},GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID},FRONTEND_ORIGIN=${FRONTEND_ORIGIN},CONTROLS_SECRET_SEED=${CONTROLS_SECRET_SEED}"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" \
  --project "${GCP_PROJECT_ID}" \
  --region "${GCP_REGION}" \
  --format='value(status.url)')"

echo ""
echo "=================================================================="
echo "✅ ¡Despliegue completado con éxito!"
echo "🔗 URL del Backend: ${SERVICE_URL}"
echo "🩺 Healthcheck:     ${SERVICE_URL}/api/health"
echo ""
echo "👉 Configura estas variables en el Frontend (o en GitHub Actions):"
echo "   VITE_API_BASE_URL=${SERVICE_URL}/api"
echo "   VITE_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
echo "=================================================================="
