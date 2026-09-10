import { BadRequestException } from "@nestjs/common";

export function normalizeVietnamesePhone(input: string): string {
  const compact = input.replace(/[\s().-]/g, "");
  const national = compact.startsWith("+84")
    ? `0${compact.slice(3)}`
    : compact.startsWith("84")
      ? `0${compact.slice(2)}`
      : compact;

  if (!/^0[35789]\d{8}$/.test(national)) {
    throw new BadRequestException("Vietnamese phone number is invalid");
  }
  return `+84${national.slice(1)}`;
}
