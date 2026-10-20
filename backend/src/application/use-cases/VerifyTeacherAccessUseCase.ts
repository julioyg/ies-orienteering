import { AuthorizedTeacher, normalizeEmail } from '../../domain/entities/AuthorizedTeacher.js';
import { InvalidTokenError, UnauthorizedTeacherError } from '../../domain/errors/DomainErrors.js';
import { IAuthorizedTeacherRepository } from '../../domain/repositories/IAuthorizedTeacherRepository.js';
import { ITokenVerifier, VerifiedGoogleUser } from '../../domain/services/ITokenVerifier.js';

export interface AuthenticatedTeacherSession {
  user: VerifiedGoogleUser;
  authorization: AuthorizedTeacher;
}

export class VerifyTeacherAccessUseCase {
  constructor(
    private readonly tokenVerifier: ITokenVerifier,
    private readonly teacherRepository: IAuthorizedTeacherRepository
  ) {}

  async execute(rawToken: string): Promise<AuthenticatedTeacherSession> {
    const cleanedToken = rawToken.trim();
    if (!cleanedToken) {
      throw new InvalidTokenError('No se proporcionó ningún token de autenticación.');
    }

    const verifiedUser = await this.tokenVerifier.verifyIdToken(cleanedToken);
    const normalizedEmail = normalizeEmail(verifiedUser.email);

    if (!normalizedEmail) {
      throw new InvalidTokenError('El token de Google no contiene una dirección de correo válida.');
    }

    const authorizedRecord = await this.teacherRepository.findByEmail(normalizedEmail);
    if (!authorizedRecord) {
      throw new UnauthorizedTeacherError(normalizedEmail);
    }

    return {
      user: {
        ...verifiedUser,
        email: normalizedEmail,
      },
      authorization: authorizedRecord,
    };
  }
}
