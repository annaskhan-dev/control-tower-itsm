import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerMiddleware } from '../middleware/logger.middleware';
import { AuthModule } from './auth/auth.module';
import { DriverSupportModule } from './driver-support/driver-support.module';
import { TicketsModule } from './tickets/tickets.module';
import { RoadAlertsModule } from './road-alerts/road-alerts.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // 1. ConfigModule MUST be the first import to load variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', 
    }),
    
    // 2. Updated to use environment variable for database connection
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/control-tower-db'),
    
    AuthModule,
    DriverSupportModule,
    TicketsModule,
    RoadAlertsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor() {
    console.log('--- DEBUG: AppModule check ---');
    console.log('JWT_SECRET is defined:', !!process.env.JWT_SECRET);
    // Added a log to confirm if MONGODB_URI is loaded in production
    console.log('MONGODB_URI is defined:', !!process.env.MONGODB_URI);
  }

  configure(consumer: any) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}