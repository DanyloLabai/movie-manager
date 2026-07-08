import { Controller, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VectorService } from './vector.service';

@ApiTags('Vector DB')
@Controller('api/vector')
export class VectorController {
  private readonly logger = new Logger(VectorController.name);

  constructor(private readonly vectorService: VectorService) {}
}
