import { IdentityUser, RoleName } from "./auth.types";

export interface PublicUser {
  id: string;
  email: string;
  phone: string;
  displayName: string;
  roles: RoleName[];
  avatarUrl: string | null;
}

export function toPublicUser(user: IdentityUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    roles: user.roles,
    avatarUrl:
      user.avatarObjectKey && user.avatarUpdatedAt
        ? `/api/v1/users/${user.id}/avatar?v=${user.avatarUpdatedAt.getTime()}`
        : null,
  };
}
