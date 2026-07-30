import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // TRUST_PROXY queda en false hasta que exista un reverse-proxy real
  // delante del backend (ver infra/reverse-proxy/README.md).
  const trustProxy = config.get<string>('TRUST_PROXY') === 'true';
  app.set('trust proxy', trustProxy);

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: config.get<string>('FRONTEND_ORIGIN'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<string>('BACKEND_PORT') ?? '3000';
  await app.listen(port);
}

bootstrap();
