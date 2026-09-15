import { BadRequestException } from "@nestjs/common";

export const MAX_USER_AVATAR_BYTES = 2 * 1024 * 1024;

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function createUserAvatarKey(userId: string): string {
  return `user-avatars/${userId}/avatar`;
}

export function validateUserAvatar(
  mimeType: string,
  size: number,
  data: Buffer,
): void {
  if (!supportedTypes.has(mimeType)) {
    throw new BadRequestException("Avatar image must be JPEG, PNG or WebP");
  }
  if (size > MAX_USER_AVATAR_BYTES) {
    throw new BadRequestException("Avatar image must not exceed 2 MB");
  }
  if (!matchesSignature(mimeType, data)) {
    throw new BadRequestException(
      "Avatar file signature does not match its image type",
    );
  }
}

function matchesSignature(mimeType: string, data: Buffer): boolean {
  if (mimeType === "image/jpeg") {
    return (
      data.length >= 3 &&
      data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    );
  }
  if (mimeType === "image/png") {
    return (
      data.length >= 8 &&
      data
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  return (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  );
}
