import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  
  /**
   * We override handleRequest to log exactly WHY the authentication failed.
   * Without this, NestJS throws a generic 401 and swallows the error details.
   */
  handleRequest(err, user, info, context) {
    // 1. If an error occurred or no user was found, log the specific reason
    if (err || !user) {
      const errorMessage = info?.message || 'No user found or invalid token';
      console.error(`❌ [JwtAuthGuard] Authentication Failed: ${errorMessage}`);
      
      // Throw the exception so the user gets a 401 response
      throw err || new UnauthorizedException(errorMessage);
    }

    // 2. If valid, return the user object
    return user;
  }
}