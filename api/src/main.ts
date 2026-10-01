import { createApp } from './app.factory';
import { config } from './common/config';

async function bootstrap() {
  const app = await createApp({ serveWeb: true });
  await app.listen(config().port);
}
bootstrap();
