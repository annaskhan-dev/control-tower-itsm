import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose'; // <--- Import MongooseModule
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { ConfigModule, ConfigService } from '@nestjs/config'; 
import { SessionLog, SessionLogSchema } from '../schemas/session-log.schema'; // <--- Import SessionLog schema

@Module({
  imports: [
    PassportModule,
    UsersModule,
    ConfigModule, 
    MongooseModule.forFeature([
      { name: SessionLog.name, schema: SessionLogSchema }, // <--- Register SessionLog model locally in AuthModule
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
    RolesGuard
  ],
})
export class AuthModule {}