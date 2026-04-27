import 'reflect-metadata';
import { type ValidationError, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
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
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

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

  app.enableShutdownHooks();
  await app.listen(config.env.PORT, '0.0.0.0');
}

bootstrap();
