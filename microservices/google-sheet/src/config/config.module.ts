import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { AppConfigService } from "./config.service";

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      ignoreEnvFile: process.env.NODE_ENV === "production",
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get("THROTTLE_TTL_MS") ?? 60000),
          limit: Number(config.get("THROTTLE_LIMIT") ?? 100),
          skipIf: () => false,
        },
      ],
    }),
  ],
  providers: [AppConfigService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
  exports: [AppConfigService],
})
export class AppConfigModule {}
