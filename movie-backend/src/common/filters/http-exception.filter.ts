import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { HttpErrorResponseDto } from '../dto/http-error-response.dto';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message: string | string[] = 'Internal server error';
    let errors: string | null = null;

    if (typeof exceptionResponse === 'object') {
      const responseObj = exceptionResponse as Record<string, unknown>;
      if (responseObj && 'message' in responseObj) {
        const msg = responseObj.message;
        message = Array.isArray(msg) ? msg : (msg as any) || message;
      }
      if (responseObj && 'error' in responseObj) {
        errors = (responseObj.error as string) || null;
      }
    } else {
      message = exceptionResponse;
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      message = 'Too many requests. Please wait a moment and try again.';
    }

    const errorResponse = {
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message,
      errors: errors || null,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500 || status === HttpStatus.TOO_MANY_REQUESTS) {
      this.logger.error(
        `[${status}] ${message} - ${host.switchToHttp().getRequest().url}`,
        exception.stack,
      );
    }

    response.status(status).json(errorResponse);
  }
}
