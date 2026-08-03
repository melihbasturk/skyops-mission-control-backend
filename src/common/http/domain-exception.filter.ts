import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from '../domain/domain-error';

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred.';
    let details: unknown;

    if (exception instanceof DomainError) {
      statusCode = exception.statusCode;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      code = statusCode === 400 ? 'VALIDATION_FAILED' : 'HTTP_ERROR';
      if (typeof body === 'string') message = body;
      else if (typeof body === 'object' && body) {
        const payload = body as Record<string, unknown>;
        message = Array.isArray(payload.message)
          ? 'Request validation failed.'
          : String(payload.message ?? message);
        details = Array.isArray(payload.message) ? payload.message : undefined;
      }
    }

    response.status(statusCode).json({
      statusCode,
      code,
      message,
      ...(details === undefined ? {} : { details }),
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }
}
