import { SetMetadata } from "@nestjs/common";
import { RoleName } from "../../auth/auth.types";

export const REQUIRED_ROLES = "requiredRoles";
export const Roles = (...roles: RoleName[]) =>
  SetMetadata(REQUIRED_ROLES, roles);
