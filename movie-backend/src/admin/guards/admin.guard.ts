import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/users.entity';

interface RequestWithUser extends Request {
  user: { userId: number };
}

// Runs after the global JwtAuthGuard, so req.user is already populated.
// Looks isAdmin up fresh from the DB each request (no isAdmin claim in the
// JWT) so revoking admin access doesn't require the user to log out.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const user = await this.usersRepo.findOne({
      where: { id: request.user.userId },
      select: ['id', 'isAdmin'],
    });

    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
