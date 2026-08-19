import { isAxiosError } from 'axios';

// movie-backend's HttpExceptionFilter always shapes errors as
// { statusCode, message, errors, timestamp } — see
// movie-backend/src/common/filters/http-exception.filter.ts.
export function getErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
