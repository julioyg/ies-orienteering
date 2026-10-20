import { AuthorizedTeacher } from '../entities/AuthorizedTeacher.js';

export interface IAuthorizedTeacherRepository {
  findByEmail(email: string): Promise<AuthorizedTeacher | null>;
  findAll(): Promise<AuthorizedTeacher[]>;
  save(teacher: AuthorizedTeacher): Promise<void>;
  deleteByEmail(email: string): Promise<boolean>;
}
