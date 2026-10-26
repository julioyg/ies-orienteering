import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { describe, expect, it, beforeEach } from 'vitest';
import { VerifyTeacherAccessUseCase } from './VerifyTeacherAccessUseCase.js';
import {
  AddAuthorizedTeacherUseCase,
  ListAuthorizedTeachersUseCase,
  RemoveAuthorizedTeacherUseCase,
} from './ManageAuthorizedTeachersUseCase.js';
import { GetControlsForTeacherUseCase } from './GetControlsForTeacherUseCase.js';
import { JsonAuthorizedTeacherRepository } from '../../infrastructure/repositories/JsonAuthorizedTeacherRepository.js';
import { InMemoryControlStationRepository } from '../../infrastructure/repositories/InMemoryControlStationRepository.js';
import { GoogleTokenVerifier } from '../../infrastructure/auth/GoogleTokenVerifier.js';
import {
  InvalidTokenError,
  UnauthorizedTeacherError,
  ValidationError,
} from '../../domain/errors/DomainErrors.js';
import { createApp } from '../../presentation/http/app.js';

describe('Clean Architecture Use Cases & HTTP API - Teacher Portal', () => {
  let tempFile: string;
  let teacherRepo: JsonAuthorizedTeacherRepository;
  let controlRepo: InMemoryControlStationRepository;
  let tokenVerifier: GoogleTokenVerifier;
  let verifyAccess: VerifyTeacherAccessUseCase;
  let listTeachers: ListAuthorizedTeachersUseCase;
  let addTeacher: AddAuthorizedTeacherUseCase;
  let removeTeacher: RemoveAuthorizedTeacherUseCase;
  let getControls: GetControlsForTeacherUseCase;

  beforeEach(async () => {
    tempFile = path.join(
      os.tmpdir(),
      `ies-orienteering-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    );
    teacherRepo = new JsonAuthorizedTeacherRepository(
      tempFile,
      'profesor@iessierraalmijara.es'
    );
    controlRepo = new InMemoryControlStationRepository();
    tokenVerifier = new GoogleTokenVerifier({ allowDevAuth: true });

    verifyAccess = new VerifyTeacherAccessUseCase(tokenVerifier, teacherRepo);
    listTeachers = new ListAuthorizedTeachersUseCase(teacherRepo);
    addTeacher = new AddAuthorizedTeacherUseCase(teacherRepo);
    removeTeacher = new RemoveAuthorizedTeacherUseCase(teacherRepo);
    getControls = new GetControlsForTeacherUseCase(controlRepo);
  });

  it('permite el acceso a un profesor cuyo email está en la base de datos', async () => {
    const session = await verifyAccess.execute('dev:Profesor@IESSierraAlmijara.es');
    expect(session.user.email).toBe('profesor@iessierraalmijara.es');
    expect(session.authorization.email).toBe('profesor@iessierraalmijara.es');
  });

  it('rechaza con UnauthorizedTeacherError (403) un email de Google válido pero no registrado en la BD', async () => {
    await expect(
      verifyAccess.execute('dev:alumno.intruso@gmail.com')
    ).rejects.toThrowError(UnauthorizedTeacherError);
  });

  it('rechaza con InvalidTokenError (401) un token vacío o inválido', async () => {
    await expect(verifyAccess.execute('')).rejects.toThrowError(InvalidTokenError);
  });

  it('permite añadir, listar y eliminar emails autorizados respetando las reglas de dominio', async () => {
    const added = await addTeacher.execute(
      '  Companero.EF@iessierraalmijara.es ',
      'profesor@iessierraalmijara.es'
    );
    expect(added.email).toBe('companero.ef@iessierraalmijara.es');

    const all = await listTeachers.execute();
    expect(all.map((t) => t.email)).toEqual([
      'companero.ef@iessierraalmijara.es',
      'profesor@iessierraalmijara.es',
    ]);

    // No permite duplicados
    await expect(
      addTeacher.execute('companero.ef@iessierraalmijara.es', 'profesor@iessierraalmijara.es')
    ).rejects.toThrowError(ValidationError);

    // Impide que un profesor borre su propio correo en sesión
    await expect(
      removeTeacher.execute('profesor@iessierraalmijara.es', 'profesor@iessierraalmijara.es')
    ).rejects.toThrowError(ValidationError);

    // Permite eliminar a otro correo
    await removeTeacher.execute(
      'companero.ef@iessierraalmijara.es',
      'profesor@iessierraalmijara.es'
    );
    const remaining = await listTeachers.execute();
    expect(remaining).toHaveLength(1);

    await fs.rm(tempFile, { force: true });
  });

  it('devuelve las 100 balizas oficiales (1 = SALIDA, 2..99 = CONTROL, 100 = META) y protege los endpoints HTTP', async () => {
    const controls = await getControls.execute();
    expect(controls).toHaveLength(100);
    expect(controls[0].id).toBe('1');
    expect(controls[0].type).toBe('START');
    expect(controls[1].id).toBe('2');
    expect(controls[1].type).toBe('CONTROL');
    expect(controls[98].id).toBe('99');
    expect(controls[98].type).toBe('CONTROL');
    expect(controls[99].id).toBe('100');
    expect(controls[99].type).toBe('FINISH');

    // All 100 backup codes must be unique 3-character strings
    const uniqueBackupCodes = new Set(controls.map((c) => c.backupCode));
    expect(uniqueBackupCodes.size).toBe(100);

    const app = createApp({
      verifyTeacherAccessUseCase: verifyAccess,
      getControlsForTeacherUseCase: getControls,
      listAuthorizedTeachersUseCase: listTeachers,
      addAuthorizedTeacherUseCase: addTeacher,
      removeAuthorizedTeacherUseCase: removeTeacher,
      allowDevAuth: true,
    });

    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}/api`;

    try {
      // 1. Petición sin token -> 401
      const unauthRes = await fetch(`${baseUrl}/controls`);
      expect(unauthRes.status).toBe(401);

      // 2. Petición con email no registrado -> 403
      const forbiddenRes = await fetch(`${baseUrl}/controls`, {
        headers: { Authorization: 'Bearer dev:noautorizado@gmail.com' },
      });
      expect(forbiddenRes.status).toBe(403);
      const forbiddenBody = (await forbiddenRes.json()) as { attemptedEmail?: string };
      expect(forbiddenBody.attemptedEmail).toBe('noautorizado@gmail.com');

      // 3. Petición con email autorizado -> 200 y 100 balizas
      const okRes = await fetch(`${baseUrl}/controls`, {
        headers: { Authorization: 'Bearer dev:profesor@iessierraalmijara.es' },
      });
      expect(okRes.status).toBe(200);
      const okBody = (await okRes.json()) as { controls: unknown[] };
      expect(okBody.controls).toHaveLength(100);
    } finally {
      server.close();
      await fs.rm(tempFile, { force: true });
    }
  });
});
