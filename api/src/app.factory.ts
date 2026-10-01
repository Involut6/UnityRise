import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config } from './common/config';
import { AllExceptionsFilter, requestLogger } from './common/http';

/** Builds the configured Nest app. Shared by the long-running server (main.ts) and the serverless handler. */
export async function createApp(opts: { serveWeb: boolean }) {
  const cfg = config(); // validates env; throws if invalid
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  app.set('trust proxy', 1);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.use(requestLogger);
  // Defaults plus blob: so authenticated document previews (images / PDFs fetched with the bearer token) can render.
  app.use(helmet({ contentSecurityPolicy: { directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), 'img-src': ["'self'", 'data:', 'blob:'], 'frame-src': ["'self'", 'blob:'] } } }));
  app.useBodyParser('json', { limit: '8mb' }); // uploads arrive base64-encoded
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: cfg.corsOrigins });
  if (opts.serveWeb) {
    // Serve the built web app (../web/dist) from the same origin when it exists.
    const web = join(__dirname, '..', '..', 'web', 'dist');
    if (existsSync(web)) {
      app.useStaticAssets(web);
      app.use((req: Request, res: Response, next: NextFunction) => (req.method === 'GET' && !req.path.startsWith('/api') ? res.sendFile(join(web, 'index.html')) : next()));
    }
  }
  return app;
}
