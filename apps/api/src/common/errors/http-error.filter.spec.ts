import { ConflictException } from "@nestjs/common";
import { createErrorPayload } from "./http-error.filter";

describe("HTTP error envelope", () => {
  it("returns a stable code, message, details and request id", () => {
    expect(
      createErrorPayload(
        new ConflictException({
          code: "EMAIL_EXISTS",
          message: "Email exists",
          details: { field: "email" },
        }),
        "request-123",
      ),
    ).toEqual({
      code: "EMAIL_EXISTS",
      message: "Email exists",
      details: { field: "email" },
      requestId: "request-123",
    });
  });
});
