import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { AuthRateLimitService } from "./auth-rate-limit.service";

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: AuthRateLimitService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ ip?: string; path: string }>();
    const key = `${request.path}:${request.ip ?? "unknown"}`;
    if (!this.limiter.consume(key, 10, 60_000)) {
      throw new HttpException(
        "Too many authentication attempts",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
