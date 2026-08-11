import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

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
        if (Array.isArray(msg)) {
          message = msg as string[];
        } else if (typeof msg === 'string' && msg) {
          message = msg;
        }
      }
      if (responseObj && 'error' in responseObj) {
        errors = (responseObj.error as string) || null;
      }
    } else {
      message = exceptionResponse;
    }

    if (Number(status) === Number(HttpStatus.TOO_MANY_REQUESTS)) {
      message = 'Too many requests. Please wait a moment and try again.';
    }

    const errorResponse = {
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message,
      errors: errors || null,
      timestamp: new Date().toISOString(),
    };

    if (
      status >= 500 ||
      Number(status) === Number(HttpStatus.TOO_MANY_REQUESTS)
    ) {
      this.logger.error(
        `[${status}] ${errorResponse.message} - ${host.switchToHttp().getRequest<Request>().url}`,
        exception.stack,
      );
    }

    response.status(status).json(errorResponse);
  }
}
