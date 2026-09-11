import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { RoleName } from "../auth/auth.types";
import {
  IDENTITY_REPOSITORY,
  IdentityRepository,
} from "../auth/identity.repository";
import { normalizeVietnamesePhone } from "../auth/phone";

@Injectable()
export class UsersService {
  constructor(
    @Inject(IDENTITY_REPOSITORY)
    private readonly repository: IdentityRepository,
  ) {}

  async profile(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new NotFoundException("User not found");
    return this.publicUser(user);
  }

  async updateProfile(
    userId: string,
    input: { displayName?: string; phone?: string },
  ) {
    const user = await this.repository.updateProfile(userId, {
      ...(input.displayName ? { displayName: input.displayName.trim() } : {}),
      ...(input.phone ? { phone: normalizeVietnamesePhone(input.phone) } : {}),
    });
    return this.publicUser(user);
  }

  async adminList(filters: {
    query?: string;
    locked?: boolean;
    role?: RoleName;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const result = await this.repository.listUsers(
      (page - 1) * pageSize,
      pageSize,
      filters,
    );
    return {
      items: result.items.map((user) => ({
        id: user.id,
        email: user.email,
        phone: user.phone,
        displayName: user.displayName,
        roles: user.roles,
        isLocked: user.isLocked,
      })),
      total: result.total,
      page,
      pageSize,
    };
  }

  async setLocked(userId: string, locked: boolean, actorId: string) {
    if (locked && userId === actorId) {
      throw new BadRequestException("Administrators cannot lock themselves");
    }
    if (!(await this.repository.findUserById(userId))) {
      throw new NotFoundException("User not found");
    }
    const user = await this.repository.setLocked(userId, locked, actorId);
    return { id: user.id, isLocked: user.isLocked };
  }

  private publicUser(
    user: Awaited<ReturnType<IdentityRepository["findUserById"]>>,
  ) {
    if (!user) throw new NotFoundException("User not found");
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      displayName: user.displayName,
      roles: user.roles,
    };
  }
}
