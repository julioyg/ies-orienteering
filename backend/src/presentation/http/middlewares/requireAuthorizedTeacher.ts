import { NextFunction, Request, Response } from 'express';
import {
  AuthenticatedTeacherSession,
  VerifyTeacherAccessUseCase,
} from '../../../application/use-cases/VerifyTeacherAccessUseCase.js';
import {
  DomainError,
  InvalidTokenError,
  UnauthorizedTeacherError,
} from '../../../domain/errors/DomainErrors.js';

declare global {
  namespace Express {
    interface Request {
      teacherSession?: AuthenticatedTeacherSession;
    }
  }
}

export function createRequireAuthorizedTeacherMiddleware(
  verifyTeacherAccessUseCase: VerifyTeacherAccessUseCase
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization ?? '';
      if (!authHeader.toLowerCase().startsWith('bearer ')) {
        throw new InvalidTokenError(
          'Falta la cabecera Authorization: Bearer <google_id_token>.'
        );
      }

      const rawToken = authHeader.slice(7).trim();
      const session = await verifyTeacherAccessUseCase.execute(rawToken);
      req.teacherSession = session;
      next();
    } catch (error) {
      handleHttpError(error, res);
    }
  };
}

export function handleHttpError(error: unknown, res: Response): void {
  if (error instanceof UnauthorizedTeacherError) {
    res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      attemptedEmail: error.attemptedEmail,
    });
    return;
  }

  if (error instanceof DomainError) {
    res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
    });
    return;
  }

  console.error('[Backend Error]', error);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Error interno en el servidor del profesorado.',
  });
}
