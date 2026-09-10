import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Principal } from "../../auth/auth.types";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal =>
    context.switchToHttp().getRequest<{ user: Principal }>().user,
);
