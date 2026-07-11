import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminGuard } from './guards/admin.guard';
import { AiUsageLogService } from '../ai-chat/ai-usage-log.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('api/admin')
export class AdminController {
  constructor(private readonly aiUsageLogService: AiUsageLogService) {}

  @Get('ai-usage/stats')
  @ApiOperation({
    summary: 'Get AI provider usage stats',
    description:
      'Aggregate Groq/Gemini request counts and failover rate for the last 24h/7d/30d (admin only)',
  })
  @ApiResponse({ status: 200, description: 'AI usage stats' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async getAiUsageStats() {
    return this.aiUsageLogService.getStats();
  }
}
