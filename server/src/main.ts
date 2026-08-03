import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
  });

  const port = parseInt(process.env.PORT, 10) || 5000;

  // Listen on 0.0.0.0 for external access
  await app.listen(port, '0.0.0.0');
  console.log(`Application is successfully running on port: ${port}`);
}

// THIS IS THE CRITICAL ADDITION:
// If there is any error during startup, this will print it to your logs
bootstrap().catch((err) => {
  console.error('CRITICAL STARTUP ERROR:', err);
  process.exit(1);
});