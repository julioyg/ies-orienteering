export class DomainError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class InvalidTokenError extends DomainError {
  constructor(message = 'El token de autenticación de Google no es válido o ha expirado.') {
    super(message, 401, 'INVALID_TOKEN');
  }
}

export class UnauthorizedTeacherError extends DomainError {
  public readonly attemptedEmail: string;

  constructor(email: string) {
    super(
      `El correo «${email}» no está en la lista de profesores autorizados.`,
      403,
      'UNAUTHORIZED_TEACHER'
    );
    this.attemptedEmail = email;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}
