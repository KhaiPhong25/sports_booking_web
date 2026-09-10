import { BadRequestException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateVenueImage(mimeType: string, size: number): void {
  if (!extensions[mimeType]) {
    throw new BadRequestException("Venue image must be JPEG, PNG or WebP");
  }
  if (size > 5 * 1024 * 1024) {
    throw new BadRequestException("Venue image must not exceed 5 MB");
  }
}

export function createVenueImageKey(venueId: string, mimeType: string): string {
  validateVenueImage(mimeType, 0);
  return `venues/${venueId}/${randomUUID()}.${extensions[mimeType]}`;
}
