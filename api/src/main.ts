import { createApp } from './app.factory.js';
import { config } from './common/config.js';

async function bootstrap() {
  const app = await createApp({ serveWeb: true });
  await app.listen(config().port);
}
bootstrap();
