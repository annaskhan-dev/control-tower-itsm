import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './users/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true; // Public route

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) return false;

    // Normalize user role and required roles to handle casing and spacing variations (e.g. "Shipper Ops" vs "shipper_ops")
    const normalizedUserRole = user.role.replace(/\s+/g, '_').toLowerCase();
    
    return requiredRoles.some(
      role => role.replace(/\s+/g, '_').toLowerCase() === normalizedUserRole
    );
  }
}