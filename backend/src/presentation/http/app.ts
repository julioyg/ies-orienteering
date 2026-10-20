import cors from 'cors';
import express, { Express } from 'express';
import {
  createTeacherRouter,
  TeacherRouterDependencies,
} from './routes/teacherRoutes.js';

export interface CreateAppOptions extends TeacherRouterDependencies {
  frontendOrigin?: string;
}

export function createApp(options: CreateAppOptions): Express {
  const app = express();

  const allowedOrigins = options.frontendOrigin
    ? options.frontendOrigin.split(',').map((o) => o.trim())
    : ['*'];

  app.use(
    cors({
      origin: allowedOrigins.includes('*') ? true : allowedOrigins,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json());
  app.use('/api', createTeacherRouter(options));

  return app;
}
