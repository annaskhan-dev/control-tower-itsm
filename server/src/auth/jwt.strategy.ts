import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // getOrThrow() ensures the value is a string, resolving your TS error.
      // If JWT_SECRET is missing, the application will throw an error immediately on startup.
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    this.logger.debug(`JWT Payload Received: ${JSON.stringify(payload)}`);

    if (!payload.role) {
      this.logger.error('JWT Payload is missing "role" field!');
      throw new UnauthorizedException('Token is invalid: missing role');
    }

    return { 
      sub: payload.sub, 
      companyId: payload.companyId,
      role: payload.role 
    };
  }
}