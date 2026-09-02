import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import hpp from "hpp";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";
import { AppConfigService } from "./config/config.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === "production" ? ["log", "warn", "error"] : ["log", "warn", "error", "debug", "verbose", "fatal"],
  });

  const config = app.get(AppConfigService);

  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance.disable("x-powered-by");
  if (config.trustProxy) {
    expressInstance.set("trust proxy", config.trustProxy);
  }

  //    Security headers                   
  app.use(
    helmet({
      // Swagger UI requires inline scripts; CSP relaxed only when docs enabled.
      contentSecurityPolicy: config.swaggerEnabled ? false : undefined,
      crossOriginResourcePolicy: config.swaggerEnabled ? { policy: "cross-origin" } : undefined,
      referrerPolicy: { policy: "no-referrer" },
    }),
  );

  //    HTTP parameter pollution guard  
  app.use(hpp());

  //    Request size limits   
  app.use(json({ limit: config.bodyLimit }));
  app.use(urlencoded({ extended: true, limit: config.bodyLimit }));

  //    CORS: strict origin allowlist   
  app.enableCors({
    origin: config.allowedOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    maxAge: 600,
  });

  //    Global validation: strip unknown, reject extra props   
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  //    API shape: /api/v1/*   
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  //    OpenAPI docs (opt-in, never exposed in production unless forced)   
  if (config.swaggerEnabled) {
    const docConfig = new DocumentBuilder()
      .setTitle("Google Sheet Service API")
      .setDescription("Control-Stock Google Sheets integration microservice")
      .setVersion("0.1.0")
      .addBearerAuth()
      .addServer(config.publicBaseUrl ?? "", "Current deployment")
      .build();
    const document = SwaggerModule.createDocument(app, docConfig);
    SwaggerModule.setup("api/docs", app, document, {
      swaggerOptions: { persistAuthorization: false, displayRequestDuration: true },
      customSiteTitle: "Google Sheet Service — API Docs",
    });
  }

  app.enableShutdownHooks();

  await app.listen(config.port, config.host);
  console.log(
    JSON.stringify({
      event: "started",
      service: "google-sheet",
      host: config.host,
      port: config.port,
      docs: config.swaggerEnabled ? `/api/docs` : null,
      env: config.nodeEnv,
    }),
  );
}

bootstrap().catch((err) => {
  console.error(JSON.stringify({ event: "bootstrap_failed", error: String(err) }));
  process.exit(1);
});
