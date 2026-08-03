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
// 1. Import your UsersModule
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // 1. ConfigModule MUST be the first import to load variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', 
    }),
    MongooseModule.forRoot('mongodb://127.0.0.1:27017/control-tower-db'),
    AuthModule,
    DriverSupportModule,
    TicketsModule,
    RoadAlertsModule,
    // 2. Add UsersModule here
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor() {
    console.log('--- DEBUG: AppModule check ---');
    console.log('JWT_SECRET is defined:', !!process.env.JWT_SECRET);
  }

  configure(consumer: any) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}