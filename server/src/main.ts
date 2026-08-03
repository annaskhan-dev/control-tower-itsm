import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // UPDATE: Specific origin is required when using credentials: true
  app.enableCors({
    origin: 'https://control-tower-itsm.netlify.app', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
  });

  // Use the port provided by Railway, or default to 5000
  const port = parseInt(process.env.PORT || '5000', 10);

  // Listen on 0.0.0.0 for external access
  await app.listen(port, '0.0.0.0');
  console.log(`Application is successfully running on port: ${port}`);
}

// Global error handling
bootstrap().catch((err) => {
  console.error('CRITICAL STARTUP ERROR:', err);
  process.exit(1);
});