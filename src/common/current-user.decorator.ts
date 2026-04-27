import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export type AuthUser = { id: string; username: string };

export const CurrentUser = createParamDecorator((_data, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
  return req.user;
});
