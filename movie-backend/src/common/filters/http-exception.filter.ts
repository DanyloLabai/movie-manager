import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message: string | string[] = 'Internal server error';
    let errors: any = null;

    if (typeof exceptionResponse === 'object') {
      const responseObj = exceptionResponse as any;
      message = responseObj.message || message;
      errors = responseObj.error;
    } else {
      message = exceptionResponse;
    }

    // Handle 429 Too Many Requests
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      message = 'Too many requests. Please wait a moment and try again.';
    }

    const errorResponse = {
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message,
      errors: errors || null,
      timestamp: new Date().toISOString(),
    };

    // Log error for debugging
    if (status >= 500 || status === HttpStatus.TOO_MANY_REQUESTS) {
      this.logger.error(
        `[${status}] ${message} - ${host.switchToHttp().getRequest().url}`,
        exception.stack,
      );
    }

    response.status(status).json(errorResponse);
  }
}
