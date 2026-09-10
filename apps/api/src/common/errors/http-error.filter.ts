import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { randomUUID } from "node:crypto";

interface ErrorObject {
  code?: string;
  message?: string | string[];
  details?: unknown;
}

export function createErrorPayload(exception: unknown, requestId: string) {
  const status =
    exception instanceof HttpException ? exception.getStatus() : 500;
  const response =
    exception instanceof HttpException ? exception.getResponse() : null;
  const object: ErrorObject =
    typeof response === "object" && response ? response : {};
  const rawMessage =
    object.message ??
    (typeof response === "string" ? response : "Internal server error");
  const message = Array.isArray(rawMessage)
    ? "Request validation failed"
    : rawMessage;
  const details =
    object.details ??
    (Array.isArray(rawMessage) ? { violations: rawMessage } : null);
  return {
    code: object.code ?? `HTTP_${status}`,
    message,
    details,
    requestId,
  };
}

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const requestId = request.get("x-request-id") ?? randomUUID();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    response.setHeader("x-request-id", requestId);
    response.status(status).json(createErrorPayload(exception, requestId));
  }
}
