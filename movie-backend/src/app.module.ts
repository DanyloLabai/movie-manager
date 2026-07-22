import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { AiChatModule } from './ai-chat/ai-chat.module';
import { MoviesModule } from './movies/movies.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ScheduleModule } from '@nestjs/schedule';
import { VectorModule } from './vector/vector.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PushModule } from './push/push.module';
import { AdminModule } from './admin/admin.module';
import { QuizModule } from './quiz/quiz.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          url:
            configService.get<string>('REDIS_URL') || 'redis://localhost:6379',
          ttl: 86400000,
        }),
      }),
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');

        return {
          type: 'postgres',
          url: databaseUrl,
          host: !databaseUrl ? configService.get<string>('DB_HOST') : undefined,
          port: !databaseUrl ? configService.get<number>('DB_PORT') : undefined,
          username: !databaseUrl
            ? configService.get<string>('DB_USER')
            : undefined,
          password: !databaseUrl
            ? configService.get<string>('DB_PASSWORD')
            : undefined,
          database: !databaseUrl
            ? configService.get<string>('DB_NAME')
            : undefined,

          autoLoadEntities: true,
          synchronize: process.env.NODE_ENV !== 'production',
          ssl:
            process.env.NODE_ENV === 'production'
              ? { rejectUnauthorized: false }
              : false,
          // Explicit cap so this pool plus VectorService's own pg.Pool (see
          // vector.service.ts) stay within a managed/serverless Postgres
          // plan's total connection limit. Tune to whatever the plan allows.
          extra: { max: 10 },
        };
      },
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    AiChatModule,
    MoviesModule,
    AuthModule,
    UsersModule,
    VectorModule,
    PushModule,
    AdminModule,
    QuizModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
