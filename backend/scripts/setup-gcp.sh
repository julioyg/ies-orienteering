#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${BACKEND_DIR}/.env.deploy"

echo "=================================================================="
echo " ☁️  Configuración Inicial de Google Cloud (Firestore + Cloud Run)"
echo "=================================================================="

if ! command -v gcloud >/dev/null 2>&1; then
  echo "❌ Error: No se encontró el comando 'gcloud'."
  echo "   Instala Google Cloud SDK desde: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

if [[ -f "${ENV_FILE}" ]]; then
  echo "📄 Cargando variables desde ${ENV_FILE}..."
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
else
  echo "ℹ️  No se encontró ${ENV_FILE}. Puedes crearlo copiando .env.deploy.example."
fi

GCP_PROJECT_ID="${GCP_PROJECT_ID:-}"
FIRESTORE_LOCATION="${FIRESTORE_LOCATION:-eur3}"

if [[ -z "${GCP_PROJECT_ID}" || "${GCP_PROJECT_ID}" == "tu-proyecto-gcp" ]]; then
  read -r -p "👉 Introduce el ID de tu proyecto de Google Cloud (GCP_PROJECT_ID): " GCP_PROJECT_ID
fi

if [[ -z "${GCP_PROJECT_ID}" ]]; then
  echo "❌ Error: Debes especificar un GCP_PROJECT_ID válido."
  exit 1
fi

echo "🔧 Seleccionando proyecto de Google Cloud: ${GCP_PROJECT_ID}..."
gcloud config set project "${GCP_PROJECT_ID}"

echo "🚀 Habilitando APIs necesarias en Google Cloud (Cloud Run, Firestore, Cloud Build, Artifact Registry)..."
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project="${GCP_PROJECT_ID}"

echo "🗄️  Verificando base de datos Cloud Firestore '(default)'..."
if gcloud firestore databases describe --database="(default)" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
  echo "✅ La base de datos Firestore '(default)' ya existe en el proyecto."
else
  echo "📦 Creando base de datos Firestore en modo nativo (ubicación: ${FIRESTORE_LOCATION})..."
  gcloud firestore databases create \
    --database="(default)" \
    --location="${FIRESTORE_LOCATION}" \
    --type=firestore-native \
    --project="${GCP_PROJECT_ID}"
  echo "✅ Base de datos Cloud Firestore creada correctamente."
fi

echo ""
echo "🎉 ¡Infraestructura lista en Google Cloud!"
echo "Siguiente paso: revisa tu archivo backend/.env.deploy y ejecuta:"
echo "  npm run deploy"
