import { Router } from 'express';
import { GetControlsForTeacherUseCase } from '../../../application/use-cases/GetControlsForTeacherUseCase.js';
import {
  AddAuthorizedTeacherUseCase,
  ListAuthorizedTeachersUseCase,
  RemoveAuthorizedTeacherUseCase,
} from '../../../application/use-cases/ManageAuthorizedTeachersUseCase.js';
import { VerifyTeacherAccessUseCase } from '../../../application/use-cases/VerifyTeacherAccessUseCase.js';
import {
  createRequireAuthorizedTeacherMiddleware,
  handleHttpError,
} from '../middlewares/requireAuthorizedTeacher.js';

export interface TeacherRouterDependencies {
  verifyTeacherAccessUseCase: VerifyTeacherAccessUseCase;
  getControlsForTeacherUseCase: GetControlsForTeacherUseCase;
  listAuthorizedTeachersUseCase: ListAuthorizedTeachersUseCase;
  addAuthorizedTeacherUseCase: AddAuthorizedTeacherUseCase;
  removeAuthorizedTeacherUseCase: RemoveAuthorizedTeacherUseCase;
  allowDevAuth?: boolean;
}

export function createTeacherRouter(deps: TeacherRouterDependencies): Router {
  const router = Router();
  const requireTeacher = createRequireAuthorizedTeacherMiddleware(
    deps.verifyTeacherAccessUseCase
  );

  // Public health & auth config endpoint
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      allowDevAuth: Boolean(deps.allowDevAuth),
    });
  });

  // Verify token and check if the teacher email is whitelisted in the DB
  router.get('/auth/me', requireTeacher, (req, res) => {
    res.json({
      authenticated: true,
      user: req.teacherSession!.user,
      authorization: req.teacherSession!.authorization,
    });
  });

  // Protected route: returns the 22 official QR controls & backup codes
  router.get('/controls', requireTeacher, async (_req, res) => {
    try {
      const controls = await deps.getControlsForTeacherUseCase.execute();
      res.json({ controls });
    } catch (error) {
      handleHttpError(error, res);
    }
  });

  // Protected route: list all authorized teacher emails in the database
  router.get('/teachers', requireTeacher, async (_req, res) => {
    try {
      const teachers = await deps.listAuthorizedTeachersUseCase.execute();
      res.json({ teachers });
    } catch (error) {
      handleHttpError(error, res);
    }
  });

  // Protected route: add a new authorized teacher email
  router.post('/teachers', requireTeacher, async (req, res) => {
    try {
      const rawEmail = typeof req.body?.email === 'string' ? req.body.email : '';
      const requesterEmail = req.teacherSession!.user.email;
      const created = await deps.addAuthorizedTeacherUseCase.execute(
        rawEmail,
        requesterEmail
      );
      res.status(201).json({ teacher: created });
    } catch (error) {
      handleHttpError(error, res);
    }
  });

  // Protected route: remove an authorized teacher email
  router.delete('/teachers/:email', requireTeacher, async (req, res) => {
    try {
      const rawParam = Array.isArray(req.params.email)
        ? req.params.email[0]
        : req.params.email;
      const targetEmail = decodeURIComponent(rawParam ?? '');
      const requesterEmail = req.teacherSession!.user.email;
      await deps.removeAuthorizedTeacherUseCase.execute(targetEmail, requesterEmail);
      res.json({ deleted: true, email: targetEmail });
    } catch (error) {
      handleHttpError(error, res);
    }
  });

  return router;
}
