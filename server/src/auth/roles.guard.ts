import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are required, allow access
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // --- DEBUG LOGS (Keep these until you confirm the 401 is resolved) ---
    console.log("🔍 [RolesGuard DEBUG] Checking Access:");
    console.log("   - Required Roles:", requiredRoles);
    console.log("   - User Object found:", !!user);
    console.log("   - User Role found:", user?.role);

    // If JwtAuthGuard didn't run first, 'user' will be undefined
    if (!user) {
      this.logger.error('RolesGuard: Access denied, no user object found. Did JwtAuthGuard run first?');
      throw new ForbiddenException('Authentication required');
    }

    // Bypass for Super Admin
    if (user.role === 'Super Admin') {
      return true;
    }

    if (!user.role) {
      this.logger.error(`RolesGuard: User ${user.sub} has no assigned role.`);
      throw new ForbiddenException('User has no assigned role');
    }

    // Role Matching
    const hasRole = requiredRoles.some((role) => 
      role.toLowerCase().trim() === user.role.toLowerCase().trim()
    );

    if (!hasRole) {
      this.logger.warn(`Access Denied: User role "${user.role}" does not match [${requiredRoles.join(', ')}]`);
      throw new ForbiddenException(`Access denied. You have the role "${user.role}", but this action requires one of: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}