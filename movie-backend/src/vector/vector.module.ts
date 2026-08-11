import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VectorController } from './vector.controller';
import { VectorService } from './vector.service';

@Module({
  imports: [ConfigModule],
  providers: [VectorService],
  controllers: [VectorController],
  exports: [VectorService],
})
export class VectorModule {}
