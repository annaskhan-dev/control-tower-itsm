import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule'; // <-- 1. Import Schedule Module
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerMiddleware } from '../middleware/logger.middleware';

// Feature Modules
import { AuthModule } from './auth/auth.module';
import { DriverSupportModule } from './driver-support/driver-support.module';
import { TicketsModule } from './tickets/tickets.module';
import { RoadAlertsModule } from './road-alerts/road-alerts.module';
import { UsersModule } from './users/users.module';

// Schemas & Controllers
import { SessionLog, SessionLogSchema } from './schemas/session-log.schema';
import { Ticket, TicketSchema } from './tickets/schemas/ticket.schema';
import { AnalyticsController } from '../controllers/analytics.controller';
import { AuthController } from './auth/auth.controller';

@Module({
  imports: [
    // 1. ConfigModule must be first to load environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 2. Enable NestJS Task Scheduling (Cron jobs)
    ScheduleModule.forRoot(),
    
    // 3. Safely resolve environment variables post-configuration load
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://127.0.0.1:27017/control-tower-db',
        bufferCommands: false, // Disables mongoose command buffering to prevent timeout errors
      }),
      inject: [ConfigService],
    }),

    // 4. Register global SessionLog and Ticket schemas for dependency injection
    MongooseModule.forFeature([
      { name: SessionLog.name, schema: SessionLogSchema },
      { name: Ticket.name, schema: TicketSchema },
    ]),
    
    AuthModule,
    DriverSupportModule,
    TicketsModule,
    RoadAlertsModule,
    UsersModule,
  ],
  controllers: [
    AppController,
    AnalyticsController,
    AuthController,
  ],
  providers: [AppService],
})
export class AppModule {
  constructor() {
    console.log('--- DEBUG: AppModule initialized ---');
    console.log('JWT_SECRET is defined:', !!process.env.JWT_SECRET);
    console.log('MONGODB_URI is defined:', !!process.env.MONGODB_URI);
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}