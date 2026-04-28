import 'reflect-metadata';
import 'dotenv/config'; // load .env into process.env before AppConfigService reads it
import { type ValidationError, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './chat/socket-io.adapter';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { ValidationException } from './common/exceptions';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { AppConfigService } from './config/config.service';

function flattenErrors(errors: ValidationError[]): string {
  for (const err of errors) {
    if (err.constraints) {
      const first = Object.values(err.constraints)[0];
      if (first) return first;
    }
    if (err.children?.length) {
      const nested = flattenErrors(err.children);
      if (nested) return nested;
    }
  }
  return 'Invalid request payload';
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get(AppConfigService);

  app.use(helmet());
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      exceptionFactory: (errors) => new ValidationException(flattenErrors(errors)),
    }),
  );

  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  app.useWebSocketAdapter(new RedisIoAdapter(app));

  app.enableShutdownHooks();
  await app.listen(config.env.PORT, '0.0.0.0');
}

bootstrap();
