import { OAuth2Client } from 'google-auth-library';
import { normalizeEmail } from '../../domain/entities/AuthorizedTeacher.js';
import { InvalidTokenError } from '../../domain/errors/DomainErrors.js';
import { ITokenVerifier, VerifiedGoogleUser } from '../../domain/services/ITokenVerifier.js';

export interface GoogleTokenVerifierOptions {
  googleClientId?: string;
  allowDevAuth?: boolean;
}

export class GoogleTokenVerifier implements ITokenVerifier {
  private readonly oauthClient: OAuth2Client;
  private readonly googleClientId?: string;
  private readonly allowDevAuth: boolean;

  constructor(options: GoogleTokenVerifierOptions = {}) {
    this.googleClientId = options.googleClientId?.trim() || undefined;
    this.allowDevAuth = Boolean(options.allowDevAuth);
    this.oauthClient = new OAuth2Client(this.googleClientId);
  }

  async verifyIdToken(idToken: string): Promise<VerifiedGoogleUser> {
    // Support local development token ("dev:<email>") only when explicitly enabled
    if (this.allowDevAuth && idToken.startsWith('dev:')) {
      const devEmail = normalizeEmail(idToken.slice(4));
      if (!devEmail || !devEmail.includes('@')) {
        throw new InvalidTokenError('El token de desarrollo debe tener el formato dev:correo@dominio.es');
      }
      return {
        email: devEmail,
        name: `Profesor (${devEmail.split('@')[0]})`,
      };
    }

    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: this.googleClientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new InvalidTokenError('El token de Google no contiene el email del usuario.');
      }

      if (payload.email_verified === false) {
        throw new InvalidTokenError('La cuenta de Google no tiene el correo verificado.');
      }

      return {
        email: normalizeEmail(payload.email),
        name: payload.name,
        picture: payload.picture,
      };
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        throw error;
      }
      throw new InvalidTokenError(
        'No se pudo verificar la credencial de Google. Inicia sesión nuevamente.'
      );
    }
  }
}
