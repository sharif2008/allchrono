import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Coarse-grained authorization: does the caller hold at least one of the
 * required roles? Fine-grained ownership checks (e.g. "buyer assigned to THIS
 * trade") live in the application services, not here.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) {
      throw new ForbiddenException('Missing authenticated user');
    }
    const allowed = user.roles.some((role) => required.includes(role));
    if (!allowed) {
      throw new ForbiddenException('Insufficient role for this action');
    }
    return true;
  }
}
