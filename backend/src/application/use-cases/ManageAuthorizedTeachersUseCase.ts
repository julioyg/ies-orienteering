import {
  AuthorizedTeacher,
  isValidEmail,
  normalizeEmail,
} from '../../domain/entities/AuthorizedTeacher.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';
import { IAuthorizedTeacherRepository } from '../../domain/repositories/IAuthorizedTeacherRepository.js';

export class ListAuthorizedTeachersUseCase {
  constructor(private readonly teacherRepository: IAuthorizedTeacherRepository) {}

  async execute(): Promise<AuthorizedTeacher[]> {
    const list = await this.teacherRepository.findAll();
    return [...list].sort((a, b) => a.email.localeCompare(b.email));
  }
}

export class AddAuthorizedTeacherUseCase {
  constructor(private readonly teacherRepository: IAuthorizedTeacherRepository) {}

  async execute(rawEmail: string, addedByEmail: string): Promise<AuthorizedTeacher> {
    const email = normalizeEmail(rawEmail);
    if (!isValidEmail(email)) {
      throw new ValidationError(`La dirección de correo «${rawEmail}» no tiene un formato válido.`);
    }

    const existing = await this.teacherRepository.findByEmail(email);
    if (existing) {
      throw new ValidationError(`El correo «${email}» ya está registrado como autorizado.`);
    }

    const record: AuthorizedTeacher = {
      email,
      addedAt: new Date().toISOString(),
      addedBy: normalizeEmail(addedByEmail),
    };

    await this.teacherRepository.save(record);
    return record;
  }
}

export class RemoveAuthorizedTeacherUseCase {
  constructor(private readonly teacherRepository: IAuthorizedTeacherRepository) {}

  async execute(targetRawEmail: string, requesterEmail: string): Promise<void> {
    const targetEmail = normalizeEmail(targetRawEmail);
    const currentEmail = normalizeEmail(requesterEmail);

    if (!targetEmail) {
      throw new ValidationError('Debes indicar el correo a eliminar.');
    }

    if (targetEmail === currentEmail) {
      throw new ValidationError(
        'Por seguridad no puedes eliminar tu propio correo en sesión activa.'
      );
    }

    const deleted = await this.teacherRepository.deleteByEmail(targetEmail);
    if (!deleted) {
      throw new ValidationError(`El correo «${targetEmail}» no figuraba en la base de datos.`);
    }
  }
}
