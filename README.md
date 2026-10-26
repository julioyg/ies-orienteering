# 🧭 IES Sierra Almijara · Tarjeta Virtual SPORTident (PWA) + Portal del Profesor

Aplicación web de **Orientación Deportiva** para el **IES Sierra Almijara** dividida en dos partes claramente diferenciadas:

1. **App del Alumno (100 % Estática y Offline-First en GitHub Pages):** Convierte cualquier teléfono móvil en una tarjeta electrónica **SPORTident (SI-Card)** con lectura de códigos QR, códigos manuales de 3 letras, sonido (`2400 Hz`) y persistencia en `localStorage`, sin realizar llamadas a servidor ni almacenar datos personales.
2. **Portal del Profesorado (Protegido con Google Sign-In + Clean Architecture Backend):** Protege el acceso a las 100 balizas oficiales QR (`1` = SALIDA, `2..99` = Controles, `100` = META, en formato A4 imprimible) y permite gestionar en una base de datos la **lista blanca de correos de Google autorizados** para acceder al panel. Los códigos secretos se derivan criptográficamente en el backend a partir de `CONTROLS_SECRET_SEED`, mientras que el frontend público solo almacena los hashes SHA-256 con sal (`src/data/controls.ts`).

---

## 🏛️ Arquitectura del Backend (`backend/`)

El servidor del profesorado está construido en **Node.js + TypeScript** aplicando **Clean Architecture**:

- **`src/domain/`**: Entidades (`AuthorizedTeacher`, `ControlStation`), errores de dominio (`UnauthorizedTeacherError`, `InvalidTokenError`, `ValidationError`) y contratos/interfaces (`IAuthorizedTeacherRepository`, `IControlStationRepository`, `ITokenVerifier`).
- **`src/application/use-cases/`**: Casos de uso desacoplados de la infraestructura (`VerifyTeacherAccessUseCase`, `GetControlsForTeacherUseCase`, `ListAuthorizedTeachersUseCase`, `AddAuthorizedTeacherUseCase`, `RemoveAuthorizedTeacherUseCase`).
- **`src/infrastructure/`**:
  - `FirestoreAuthorizedTeacherRepository`: Repositorio de producción sobre **Google Cloud Firestore** (plan gratuito *Spark*).
  - `JsonAuthorizedTeacherRepository`: Repositorio en archivo JSON local (`backend/data/authorized_teachers.json`) para desarrollo y tests sin configuración externa.
  - `GoogleTokenVerifier`: Validación criptográfica del `id_token` de Google mediante `google-auth-library`.
- **`src/presentation/http/`**: Servidor Express, middleware `requireAuthorizedTeacher` y endpoints REST (`/api/auth/me`, `/api/controls`, `/api/teachers`).

---

## 🛠️ Desarrollo Local Rápido

### 1. Iniciar el Backend del Profesorado
```bash
cd backend
npm install
npm run dev
```
Por defecto, el backend arranca en `http://localhost:8080/api` usando el repositorio local JSON (`DB_PROVIDER=json`), habilitando el modo de prueba local (`ALLOW_DEV_AUTH=true`) y registrando automáticamente el correo semilla `profesor@iessierraalmijara.es`.

Para ejecutar los tests unitarios y de integración de la Clean Architecture:
```bash
cd backend
npm test
```

### 2. Iniciar el Frontend (App Alumnos + Portal Profesor)
En otra terminal en la raíz del repositorio:
```bash
npm install
npm run dev
```
- **Vista del Alumno (100 % estática):** `http://localhost:5173/ies-orienteering/`
- **Portal del Profesor (con Login):** `http://localhost:5173/ies-orienteering/?teacher=true` (o `?print=true`)

---

## ☁️ Despliegue Gratuito en Google Cloud (Firestore + Cloud Run)

El repositorio incluye scripts automatizados en `backend/scripts/` para aprovisionar la base de datos y desplegar el backend con un solo comando:

### Paso 1: Configurar variables de despliegue
Copia la plantilla y rellena tu `GCP_PROJECT_ID`, tu correo de administrador inicial (`INITIAL_ADMIN_EMAIL`) y tu `GOOGLE_CLIENT_ID`:
```bash
cp backend/.env.deploy.example backend/.env.deploy
```

### Paso 2: Aprovisionar Google Cloud y Firestore (solo la primera vez)
Habilita las APIs de Cloud Run/Firestore y crea la base de datos gratuita `(default)` en modo nativo:
```bash
npm run backend:setup
# (o dentro de backend/: npm run setup:gcp)
```

### Paso 3: Desplegar el Backend en Cloud Run
Ejecuta automáticamente los tests, verifica la compilación TypeScript y despliega el contenedor en Google Cloud Run:
```bash
npm run backend:deploy
# (o dentro de backend/: npm run deploy)
```
Al terminar, el script mostrará en pantalla la URL pública HTTPS de tu servicio y el valor exacto de `VITE_API_BASE_URL` para tu frontend en GitHub Pages.
