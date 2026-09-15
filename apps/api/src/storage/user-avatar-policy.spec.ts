import { BadRequestException } from "@nestjs/common";
import {
  MAX_USER_AVATAR_BYTES,
  createUserAvatarKey,
  validateUserAvatar,
} from "./user-avatar-policy";

describe("user avatar policy", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const webp = Buffer.from("RIFF1234WEBP", "ascii");

  it.each([
    ["image/png", png],
    ["image/jpeg", jpeg],
    ["image/webp", webp],
  ])("accepts a supported %s file with a matching signature", (type, data) => {
    expect(() => validateUserAvatar(type, data.length, data)).not.toThrow();
  });

  it("rejects a file whose signature does not match its declared type", () => {
    expect(() =>
      validateUserAvatar("image/png", 8, Buffer.from("not-png!")),
    ).toThrow(
      new BadRequestException(
        "Avatar file signature does not match its image type",
      ),
    );
  });

  it("rejects unsupported image types", () => {
    expect(() =>
      validateUserAvatar("image/gif", 6, Buffer.from("GIF89a")),
    ).toThrow(
      new BadRequestException("Avatar image must be JPEG, PNG or WebP"),
    );
  });

  it("accepts exactly 2 MiB and rejects one byte more", () => {
    expect(() =>
      validateUserAvatar("image/jpeg", MAX_USER_AVATAR_BYTES, jpeg),
    ).not.toThrow();
    expect(() =>
      validateUserAvatar("image/jpeg", MAX_USER_AVATAR_BYTES + 1, jpeg),
    ).toThrow(new BadRequestException("Avatar image must not exceed 2 MB"));
  });

  it("derives a stable object key from the authenticated user", () => {
    expect(createUserAvatarKey("user-1")).toBe("user-avatars/user-1/avatar");
  });
});
