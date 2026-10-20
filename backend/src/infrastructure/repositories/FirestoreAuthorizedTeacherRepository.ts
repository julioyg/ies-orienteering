import { getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import {
  AuthorizedTeacher,
  normalizeEmail,
} from '../../domain/entities/AuthorizedTeacher.js';
import { IAuthorizedTeacherRepository } from '../../domain/repositories/IAuthorizedTeacherRepository.js';

export class FirestoreAuthorizedTeacherRepository implements IAuthorizedTeacherRepository {
  private readonly db: Firestore;
  private readonly collectionName = 'authorized_teachers';
  private readonly initialAdminEmail?: string;
  private seeded = false;

  constructor(initialAdminEmail?: string, customFirestore?: Firestore) {
    if (customFirestore) {
      this.db = customFirestore;
    } else {
      if (getApps().length === 0) {
        initializeApp();
      }
      this.db = getFirestore();
    }
    this.initialAdminEmail = initialAdminEmail ? normalizeEmail(initialAdminEmail) : undefined;
  }

  private async ensureSeeded(): Promise<void> {
    if (this.seeded || !this.initialAdminEmail) return;
    this.seeded = true;

    const snapshot = await this.db.collection(this.collectionName).limit(1).get();
    if (snapshot.empty) {
      const record: AuthorizedTeacher = {
        email: this.initialAdminEmail,
        addedAt: new Date().toISOString(),
        addedBy: 'system-seed',
      };
      await this.db.collection(this.collectionName).doc(record.email).set(record);
    }
  }

  async findByEmail(email: string): Promise<AuthorizedTeacher | null> {
    await this.ensureSeeded();
    const normalized = normalizeEmail(email);
    const doc = await this.db.collection(this.collectionName).doc(normalized).get();
    if (!doc.exists) return null;
    const data = doc.data() as AuthorizedTeacher;
    return {
      email: normalizeEmail(data.email ?? normalized),
      addedAt: data.addedAt ?? new Date().toISOString(),
      addedBy: data.addedBy,
    };
  }

  async findAll(): Promise<AuthorizedTeacher[]> {
    await this.ensureSeeded();
    const snapshot = await this.db.collection(this.collectionName).get();
    return snapshot.docs.map((doc) => {
      const data = doc.data() as AuthorizedTeacher;
      return {
        email: normalizeEmail(data.email ?? doc.id),
        addedAt: data.addedAt ?? new Date().toISOString(),
        addedBy: data.addedBy,
      };
    });
  }

  async save(teacher: AuthorizedTeacher): Promise<void> {
    await this.ensureSeeded();
    const normalized = normalizeEmail(teacher.email);
    await this.db
      .collection(this.collectionName)
      .doc(normalized)
      .set({
        email: normalized,
        addedAt: teacher.addedAt,
        addedBy: teacher.addedBy ?? 'admin',
      });
  }

  async deleteByEmail(email: string): Promise<boolean> {
    await this.ensureSeeded();
    const normalized = normalizeEmail(email);
    const docRef = this.db.collection(this.collectionName).doc(normalized);
    const existing = await docRef.get();
    if (!existing.exists) {
      return false;
    }
    await docRef.delete();
    return true;
  }
}
