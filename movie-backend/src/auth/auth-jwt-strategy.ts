import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: number;
  username: string;
  email?: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

const extractRefreshTokenFromCookie = (req: Request): string | null => {
  return (req?.cookies?.refresh_token as string | undefined) ?? null;
};

// React Native has no browser-style cookie jar, so mobile sends the refresh
// token in the request body instead. Cookie is checked first so web's
// behavior is completely unchanged.
const extractRefreshTokenFromBody = (req: Request): string | null => {
  const body = req?.body as { refresh_token?: string } | undefined;
  return body?.refresh_token ?? null;
};

const extractRefreshToken = (req: Request): string | null => {
  return extractRefreshTokenFromCookie(req) ?? extractRefreshTokenFromBody(req);
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload) {
    return { userId: payload.sub, username: payload.username };
  }
}

@Injectable()
export class RefreshJwtStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private configService: ConfigService) {
    const jwtRefreshSecret = configService.get<string>('JWT_REFRESH_SECRET');

    if (!jwtRefreshSecret) {
      throw new Error(
        'JWT_REFRESH_SECRET environment variable is required but not defined. Please check your configuration.',
      );
    }

    super({
      jwtFromRequest: extractRefreshToken,
      ignoreExpiration: false,
      secretOrKey: jwtRefreshSecret,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload) {
    const refreshToken = extractRefreshToken(req);
    return {
      userId: payload.sub,
      username: payload.username,
      refreshToken,
      sessionId: payload.jti,
    };
  }
}
