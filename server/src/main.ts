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

  // Updated CORS configuration:
  // Restricted to your specific frontend URL
  app.enableCors({
    origin: 'https://control-tower-itsm.netlify.app',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Use PORT from environment or default to 5000
  const port = process.env.PORT || 5000;

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);
}
bootstrap();