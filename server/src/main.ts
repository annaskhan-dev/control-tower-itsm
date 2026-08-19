import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // Updated CORS configuration to allow local and production frontend URLs
  app.enableCors({
    origin: [
      'https://control-tower-itsm.netlify.app',
      'http://localhost:3000',
      'http://localhost:5173'
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, x-company-id', 
    credentials: true,
  });

  // Use the port provided by Railway (5000), or default to 5000 if not found
  const port = parseInt(process.env.PORT || '5000', 10);

  // CRITICAL: Bind to '0.0.0.0' so Railway can route traffic to this port
  await app.listen(port, '0.0.0.0');
  console.log(`Application is successfully running on port: ${port}`);
}

// Global error handling to catch startup failures
bootstrap().catch((err) => {
  console.error('CRITICAL STARTUP ERROR:', err);
  process.exit(1);
});