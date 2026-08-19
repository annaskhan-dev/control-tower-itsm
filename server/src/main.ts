import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // Permanent CORS configuration supporting production domains, Netlify previews, and local development
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin) return callback(null, true);

      const allowedPatterns = [
        /^https:\/\/.*\.netlify\.app$/,      // Matches any Netlify deploy preview or production URL
        /^https:\/\/control-tower-itsm\.netlify\.app$/,
        /^http:\/\/localhost:\d+$/,          // Matches local development ports (3000, 5173, etc.)
        /^http:\/\/127\.0\.0\.1:\d+$/,
      ];

      const isAllowed = allowedPatterns.some((pattern) => pattern.test(origin));

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, x-company-id',
    credentials: true,
  });

  const port = parseInt(process.env.PORT || '5000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`Application is successfully running on port: ${port}`);
}

bootstrap().catch((err) => {
  console.error('CRITICAL STARTUP ERROR:', err);
  process.exit(1);
});