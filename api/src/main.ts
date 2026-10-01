import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET (>=32 chars) is required');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  app.set('trust proxy', 1);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',') });
  app.use((_: any, res: any, next: any) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' }); next(); });
  // Serve the built web app (../web/dist) from the same origin in production.
  const web = join(__dirname, '..', '..', 'web', 'dist');
  if (existsSync(web)) {
    app.useStaticAssets(web);
    app.use((req: any, res: any, next: any) => (req.method === 'GET' && !req.path.startsWith('/api') ? res.sendFile(join(web, 'index.html')) : next()));
  }
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
