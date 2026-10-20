import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GetControlsForTeacherUseCase } from './application/use-cases/GetControlsForTeacherUseCase.js';
import {
  AddAuthorizedTeacherUseCase,
  ListAuthorizedTeachersUseCase,
  RemoveAuthorizedTeacherUseCase,
} from './application/use-cases/ManageAuthorizedTeachersUseCase.js';
import { VerifyTeacherAccessUseCase } from './application/use-cases/VerifyTeacherAccessUseCase.js';
import { IAuthorizedTeacherRepository } from './domain/repositories/IAuthorizedTeacherRepository.js';
import { GoogleTokenVerifier } from './infrastructure/auth/GoogleTokenVerifier.js';
import { FirestoreAuthorizedTeacherRepository } from './infrastructure/repositories/FirestoreAuthorizedTeacherRepository.js';
import { InMemoryControlStationRepository } from './infrastructure/repositories/InMemoryControlStationRepository.js';
import { JsonAuthorizedTeacherRepository } from './infrastructure/repositories/JsonAuthorizedTeacherRepository.js';
import { createApp } from './presentation/http/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT ?? 8080);
const dbProvider = (process.env.DB_PROVIDER ?? 'json').toLowerCase();
const initialAdminEmail =
  process.env.INITIAL_ADMIN_EMAIL ?? 'profesor@iessierraalmijara.es';
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const allowDevAuth =
  process.env.ALLOW_DEV_AUTH === 'true' || process.env.NODE_ENV !== 'production';
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? '*';

function buildTeacherRepository(): IAuthorizedTeacherRepository {
  if (dbProvider === 'firestore') {
    console.log('📦 Usando repositorio de producción: Google Cloud Firestore');
    return new FirestoreAuthorizedTeacherRepository(initialAdminEmail);
  }

  const jsonFilePath =
    process.env.JSON_DB_PATH ??
    path.resolve(__dirname, '../data/authorized_teachers.json');
  console.log(`📁 Usando repositorio local JSON: ${jsonFilePath}`);
  return new JsonAuthorizedTeacherRepository(jsonFilePath, initialAdminEmail);
}

const teacherRepository = buildTeacherRepository();
const controlRepository = new InMemoryControlStationRepository();
const tokenVerifier = new GoogleTokenVerifier({
  googleClientId,
  allowDevAuth,
});

const verifyTeacherAccessUseCase = new VerifyTeacherAccessUseCase(
  tokenVerifier,
  teacherRepository
);
const getControlsForTeacherUseCase = new GetControlsForTeacherUseCase(
  controlRepository
);
const listAuthorizedTeachersUseCase = new ListAuthorizedTeachersUseCase(
  teacherRepository
);
const addAuthorizedTeacherUseCase = new AddAuthorizedTeacherUseCase(
  teacherRepository
);
const removeAuthorizedTeacherUseCase = new RemoveAuthorizedTeacherUseCase(
  teacherRepository
);

const app = createApp({
  verifyTeacherAccessUseCase,
  getControlsForTeacherUseCase,
  listAuthorizedTeachersUseCase,
  addAuthorizedTeacherUseCase,
  removeAuthorizedTeacherUseCase,
  allowDevAuth,
  frontendOrigin,
});

app.listen(port, () => {
  console.log(
    `🚀 Backend del Profesorado escuchando en http://localhost:${port}/api`
  );
  console.log(`🔑 Email administrador semilla: ${initialAdminEmail}`);
});
