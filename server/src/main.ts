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
  // Using a broader approach to ensure the preflight request is handled
  app.enableCors({
    origin: '*', // Temporarily test with '*' to confirm if origin mismatch is the cause
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
  });

  // Use PORT from environment or default to 5000
  const port = process.env.PORT || 5000;

  await app.listen(port, '0.0.0.0'); // Listen on all network interfaces
  console.log(`Application is running on port: ${port}`);
}
bootstrap();