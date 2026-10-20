import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  AuthorizedTeacher,
  normalizeEmail,
} from '../../domain/entities/AuthorizedTeacher.js';
import { IAuthorizedTeacherRepository } from '../../domain/repositories/IAuthorizedTeacherRepository.js';

export class JsonAuthorizedTeacherRepository implements IAuthorizedTeacherRepository {
  private readonly filePath: string;
  private readonly initialAdminEmail?: string;
  private initialized = false;

  constructor(filePath: string, initialAdminEmail?: string) {
    this.filePath = filePath;
    this.initialAdminEmail = initialAdminEmail ? normalizeEmail(initialAdminEmail) : undefined;
  }

  private async ensureInitialized(): Promise<AuthorizedTeacher[]> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as AuthorizedTeacher[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.initialized = true;
        return parsed;
      }
    } catch {
      // File does not exist or is invalid; will seed below
    }

    const seed: AuthorizedTeacher[] = [];
    if (this.initialAdminEmail) {
      seed.push({
        email: this.initialAdminEmail,
        addedAt: new Date().toISOString(),
        addedBy: 'system-seed',
      });
    }

    await fs.writeFile(this.filePath, JSON.stringify(seed, null, 2), 'utf-8');
    this.initialized = true;
    return seed;
  }

  private async writeAll(records: AuthorizedTeacher[]): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(records, null, 2), 'utf-8');
  }

  async findByEmail(email: string): Promise<AuthorizedTeacher | null> {
    const normalized = normalizeEmail(email);
    const all = await this.ensureInitialized();
    return all.find((item) => normalizeEmail(item.email) === normalized) ?? null;
  }

  async findAll(): Promise<AuthorizedTeacher[]> {
    return this.ensureInitialized();
  }

  async save(teacher: AuthorizedTeacher): Promise<void> {
    const all = await this.ensureInitialized();
    const normalized = normalizeEmail(teacher.email);
    const filtered = all.filter((item) => normalizeEmail(item.email) !== normalized);
    filtered.push({
      ...teacher,
      email: normalized,
    });
    await this.writeAll(filtered);
  }

  async deleteByEmail(email: string): Promise<boolean> {
    const all = await this.ensureInitialized();
    const normalized = normalizeEmail(email);
    const filtered = all.filter((item) => normalizeEmail(item.email) !== normalized);
    if (filtered.length === all.length) {
      return false;
    }
    await this.writeAll(filtered);
    return true;
  }
}
