import { NestFactory } from '@nestjs/core';
import { AppModule } from '../server/src/app.module';
import { processUnreadEmails } from '../server/services/emailService'; // Adjust path if your file location is different

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // Open CORS configuration to allow all origins and prevent blocking
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, x-company-id',
    credentials: true,
    optionsSuccessStatus: 204,
  });

  // Start the background email polling worker (runs every 5 seconds)
  setInterval(() => {
    processUnreadEmails().catch((err) =>
      console.error('[Email Worker Error]:', err.message)
    );
  }, 5000);
  console.log('[Worker] Email polling cron job initialized (runs every 5 seconds).');

  const port = parseInt(process.env.PORT || '5000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`Application is successfully running on port: ${port}`);
}

bootstrap().catch((err) => {
  console.error('CRITICAL STARTUP ERROR:', err);
  process.exit(1);
});