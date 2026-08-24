import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { UsersModule } from '../users/users.module';
import { DriverSupportModule } from '../driver-support/driver-support.module';
import { AuthController } from './auth.controller';
import { ConfigModule, ConfigService } from '@nestjs/config'; 

@Module({
  imports: [
    PassportModule,
    UsersModule, // This gives AuthModule access to everything exported by UsersModule
    DriverSupportModule, // Gives AuthModule access to SessionLogModel
    ConfigModule, 
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