import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AiProvider, AiRequestType, AiUsageLog } from './ai-usage-log.entity';

export interface LogUsageParams {
  userId: number;
  provider: AiProvider;
  wasFailover: boolean;
  requestType: AiRequestType;
  tokenCount?: number | null;
  latencyMs?: number | null;
}

interface ProviderCount {
  provider: AiProvider;
  count: number;
}

export interface AiUsageWindowStats {
  totalRequests: number;
  failoverRequests: number;
  failoverRate: number;
  byProvider: ProviderCount[];
}

export interface AiUsageStats {
  last24h: AiUsageWindowStats;
  last7d: AiUsageWindowStats;
  last30d: AiUsageWindowStats;
}

const WINDOWS_MS = {
  last24h: 24 * 60 * 60 * 1000,
  last7d: 7 * 24 * 60 * 60 * 1000,
  last30d: 30 * 24 * 60 * 60 * 1000,
} as const;

@Injectable()
export class AiUsageLogService {
  private readonly logger = new Logger(AiUsageLogService.name);

  constructor(
    @InjectRepository(AiUsageLog)
    private aiUsageLogRepo: Repository<AiUsageLog>,
  ) {}

  // Fire-and-forget: called after a chat request completes. Never throws —
  // a logging failure must not affect the user-facing chat response.
  async logUsage(params: LogUsageParams): Promise<void> {
    try {
      const entry = this.aiUsageLogRepo.create({
        userId: params.userId,
        provider: params.provider,
        wasFailover: params.wasFailover,
        requestType: params.requestType,
        tokenCount: params.tokenCount ?? null,
        latencyMs: params.latencyMs ?? null,
      });
      await this.aiUsageLogRepo.save(entry);
    } catch (err) {
      this.logger.warn(
        `Failed to log AI usage: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async getUserUsageSince(
    userId: number,
    since: Date,
  ): Promise<{ requestCount: number; totalTokens: number }> {
    const row = await this.aiUsageLogRepo
      .createQueryBuilder('log')
      .select('COUNT(*)', 'requestCount')
      .addSelect('COALESCE(SUM(log.tokenCount), 0)', 'totalTokens')
      .where('log.userId = :userId', { userId })
      .andWhere('log.createdAt >= :since', { since })
      .getRawOne<{ requestCount: string; totalTokens: string }>();

    return {
      requestCount: Number(row?.requestCount ?? 0),
      totalTokens: Number(row?.totalTokens ?? 0),
    };
  }

  async getStats(): Promise<AiUsageStats> {
    const now = Date.now();
    const [last24h, last7d, last30d] = await Promise.all([
      this.getWindowStats(new Date(now - WINDOWS_MS.last24h)),
      this.getWindowStats(new Date(now - WINDOWS_MS.last7d)),
      this.getWindowStats(new Date(now - WINDOWS_MS.last30d)),
    ]);

    return { last24h, last7d, last30d };
  }

  private async getWindowStats(since: Date): Promise<AiUsageWindowStats> {
    const [byProvider, failoverRequests] = await Promise.all([
      this.aiUsageLogRepo
        .createQueryBuilder('log')
        .select('log.provider', 'provider')
        .addSelect('COUNT(*)', 'count')
        .where('log.createdAt >= :since', { since })
        .groupBy('log.provider')
        .getRawMany<{ provider: AiProvider; count: string }>(),
      this.aiUsageLogRepo.count({
        where: { wasFailover: true, createdAt: MoreThanOrEqual(since) },
      }),
    ]);

    const providerCounts: ProviderCount[] = byProvider.map((row) => ({
      provider: row.provider,
      count: Number(row.count),
    }));
    const totalRequests = providerCounts.reduce(
      (sum, row) => sum + row.count,
      0,
    );

    return {
      totalRequests,
      failoverRequests,
      failoverRate: totalRequests > 0 ? failoverRequests / totalRequests : 0,
      byProvider: providerCounts,
    };
  }
}
