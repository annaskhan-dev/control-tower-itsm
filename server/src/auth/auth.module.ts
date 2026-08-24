// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { ConfigModule, ConfigService } from '@nestjs/config'; 
import { SessionLog, SessionLogSchema } from '../schemas/session-log.schema';

@Module({
  imports: [
    PassportModule,
    UsersModule,
    ConfigModule, 
    MongooseModule.forFeature([
      { name: SessionLog.name, schema: SessionLogSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'), 
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController], 
  providers: [
    AuthService, 
    JwtStrategy, 
    JwtAuthGuard, 
    RolesGuard
  ],
  exports: [
    AuthService, 
    JwtAuthGuard, 
    RolesGuard,
    UsersModule, // <--- Export UsersModule so TicketsModule can access the User model
  ],
})
export class AuthModule {}