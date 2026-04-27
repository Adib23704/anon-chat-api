import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { RedisIoAdapter } from '../../src/chat/socket-io.adapter';
import { EnvelopeInterceptor } from '../../src/common/envelope.interceptor';
import { ValidationException } from '../../src/common/exceptions';
import { HttpExceptionFilter } from '../../src/common/http-exception.filter';

export async function buildApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();

  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      exceptionFactory: (errors) => {
        const first = errors[0]?.constraints
          ? Object.values(errors[0].constraints)[0]
          : 'Invalid request payload';
        return new ValidationException(first);
      },
    }),
  );
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useWebSocketAdapter(new RedisIoAdapter(app));

  await app.init();
  return app;
}
