import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { Reflector } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const port = process.env.PORT || 3000;
  const frontendUrl = process.env.FRONTEND_URL;

  // Express auto-generates ETags for every JSON response, which makes
  // browsers send conditional requests and can silently keep serving a
  // stale cached body via 304s — confusing on top of our own explicit
  // Redis caching (which already has real TTLs). Disable it so API
  // responses are always fetched fresh; app-level caching stays in Redis.
  app.set('etag', false);

  app.use(cookieParser());

  app.enableCors({
    origin: frontendUrl,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Register global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Register global serializer interceptor to exclude sensitive fields
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Movie Manager API')
    .setDescription(
      'API for Movie Manager - Search, track, and manage movies with AI chat support',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Movies', 'Movie search and management')
    .addTag('Users', 'User profile management')
    .addTag('AI Chat', 'AI chat with Gemini API')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on port: ${port}`);
  console.log(
    `Swagger documentation available at http://localhost:${port}/api/docs`,
  );
}

bootstrap();
