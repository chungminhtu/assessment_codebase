import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import path from 'path';
import { CustomLogger } from '../logger/winston-logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private currentDir: string;

  constructor(private readonly logger: CustomLogger) {
    this.currentDir = path.resolve(__dirname, '../../../');
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const start = process.hrtime.bigint();
    const { method, headers } = request;
    const url = (request as any).originalUrl || request.url;
    const userAgent = headers['user-agent'];
    const requestId = headers['x-request-id'] || 'N/A';
    this.logger.requestId = requestId as any;
    const ip = request.socket.remoteAddress;
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1e6;

    const message =
      exception instanceof HttpException
        ? exception.message
        : (exception as any).message;

    const stackTrace = this.cleanStackTrace((exception as any).stack);

    const logInfo: any = {
      method,
      url,
      userAgent,
      ip,
      requestId,
      duration,
      statusCode: status,
      message,
      stack: stackTrace,
    };

    this.logger.error('Exception thrown - ' + message, logInfo);

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message || 'Internal server error',
    };

    response.status(status).send(errorResponse);
  }

  private cleanStackTrace(stack: string | undefined): string {
    if (!stack) return '';
    return stack
      .split('\n')
      .map((line) => {
        if (line.includes('node:internal') || line.includes('node_modules')) {
          return '';
        }
        const relativePath = line.replace(
          new RegExp(`^${this.currentDir}`, 'g'),
          '',
        );
        relativePath.trim();
        return relativePath.replace(new RegExp(`${this.currentDir}`, 'g'), '');
      })
      .filter((line) => line !== '')
      .join('\n');
  }
}
