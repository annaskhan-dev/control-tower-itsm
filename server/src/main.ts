import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as path from 'path';

async function bootstrap() {
  // Load .env file safely
  const envPath = path.resolve(__dirname, '..', '.env');
  dotenv.config({ path: envPath });

  const app = await NestFactory.create(AppModule);

  // Global prefix setup
  app.setGlobalPrefix('api');
  app.enableCors();

  // Use PORT from environment or default to 5000
  const port = process.env.PORT || 5000;

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);
}
bootstrap();