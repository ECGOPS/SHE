import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { allowsBrowserOrigin } from './config/dev-origin';
import { validationExceptionFactory } from './common/validation/field-errors';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const port = config.get<number>('API_PORT', 4000);
  const prefix = config.get<string>('API_PREFIX', 'api/v1');

  app.setGlobalPrefix(prefix);
  app.enableCors({
    origin: (origin, callback) => {
      callback(null, allowsBrowserOrigin(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['X-CSRF-Token'],
  });

  const swaggerEnabled =
    config.get<string>('NODE_ENV') !== 'production' || config.get<boolean>('SWAGGER_ENABLED') === true;

  app.use(
    helmet({
      contentSecurityPolicy: swaggerEnabled
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
            },
          }
        : {
            directives: {
              defaultSrc: ["'none'"],
              scriptSrcAttr: ["'none'"],
              frameAncestors: ["'none'"],
              baseUri: ["'none'"],
              objectSrc: ["'none'"],
            },
          },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(compression());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false, value: false },
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ECG SHE API')
      .setDescription('Enterprise Safety, Health & Environment API for the Electricity Company of Ghana')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('auth')
      .addTag('users')
      .addTag('organizations')
      .addTag('incidents')
      .addTag('hazards')
      .addTag('near-miss')
      .addTag('jsa')
      .addTag('ptw')
      .addTag('inspections')
      .addTag('audits')
      .addTag('environmental')
      .addTag('health')
      .addTag('training')
      .addTag('ppe')
      .addTag('corrective-actions')
      .addTag('dashboard')
      .addTag('reports')
      .addTag('audit-trail')
      .build();
    const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${prefix}/docs`, app, swaggerDoc);
    logger.log(`Swagger UI         : http://localhost:${port}/${prefix}/docs`);
  }

  app.enableShutdownHooks();
  await listenWithRetry(app, port, logger);
  logger.log(`ECG SHE API listening on http://localhost:${port}/${prefix}`);
}

/**
 * Try to bind the API port, retrying on `EADDRINUSE` for up to ~10 seconds.
 *
 * Why: under `nest start --watch` the previous `node dist/main.js` child is
 * killed and a new one spawned on every recompile. On Windows the OS often
 * keeps the socket in `TIME_WAIT` for a few seconds, so the fresh child
 * fails to bind and the watcher just hangs. Retrying inside the process
 * avoids that whole class of failures without relying on the wrapper.
 */
async function listenWithRetry(
  // Loose-typed so we don't have to import the heavy NestApplication type here.
  app: { listen: (port: number) => Promise<unknown> },
  port: number,
  logger: Logger,
  maxAttempts = 8,
  delayMs = 1500,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await app.listen(port);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== 'EADDRINUSE' || attempt === maxAttempts) {
        throw err;
      }
      logger.warn(
        `Port ${port} is busy (EADDRINUSE) — retry ${attempt}/${maxAttempts - 1} ` +
          `in ${delayMs} ms… (likely a previous watch-mode child still holding the socket)`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

void bootstrap();
