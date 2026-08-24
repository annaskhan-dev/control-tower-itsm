import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerMiddleware } from '../middleware/logger.middleware';
import { AuthModule } from './auth/auth.module';
import { DriverSupportModule } from './driver-support/driver-support.module';
import { TicketsModule } from './tickets/tickets.module';
import { RoadAlertsModule } from './road-alerts/road-alerts.module';
import { UsersModule } from './users/users.module';

// 1. Import Schemas and Analytics Controller
import { SessionLog, SessionLogSchema } from './schemas/session-log.schema';
import { Ticket, TicketSchema } from './tickets/schemas/ticket.schema'; // Added Ticket schema import
import { AnalyticsController } from '../controllers/analytics.controller';

@Module({
  imports: [
    // 1. ConfigModule MUST be the first import to load variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // 2. Updated to use MongooseModule.forRootAsync to safely resolve environment variables post-configuration load
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://127.0.0.1:27017/control-tower-db',
      }),
      inject: [ConfigService],
    }),

    // 3. Register SessionLog and Ticket schemas for dependency injection
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
    AnalyticsController, // 4. Added AnalyticsController here
  ],
  providers: [AppService],
})
export class AppModule {
  constructor() {
    console.log('--- DEBUG: AppModule check ---');
    console.log('JWT_SECRET is defined:', !!process.env.JWT_SECRET);
    console.log('MONGODB_URI is defined:', !!process.env.MONGODB_URI);
  }

  configure(consumer: any) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}