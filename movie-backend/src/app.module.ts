import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AiChatModule } from './ai-chat/ai-chat.module';
import { MoviesModule } from './movies/movies.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

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
          synchronize: true,

          ssl: databaseUrl ? { rejectUnauthorized: false } : false,
        };
      },
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),

    AiChatModule,
    MoviesModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
