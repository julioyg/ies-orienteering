export interface VerifiedGoogleUser {
  email: string;
  name?: string;
  picture?: string;
}

export interface ITokenVerifier {
  verifyIdToken(idToken: string): Promise<VerifiedGoogleUser>;
}
