import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Reflector } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT || 3000;
  const frontendUrl = process.env.FRONTEND_URL;

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

  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on port: ${port}`);
}

bootstrap();
