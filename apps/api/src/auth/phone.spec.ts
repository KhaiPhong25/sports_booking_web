import { normalizeVietnamesePhone } from "./phone";

describe("normalizeVietnamesePhone", () => {
  it.each([
    ["0901234567", "+84901234567"],
    ["+84 901 234 567", "+84901234567"],
    ["84-901-234-567", "+84901234567"],
  ])("normalizes %s to E.164", (input, expected) => {
    expect(normalizeVietnamesePhone(input)).toBe(expected);
  });

  it("rejects a number outside the supported Vietnamese mobile format", () => {
    expect(() => normalizeVietnamesePhone("12345")).toThrow(
      "Vietnamese phone number",
    );
  });
});
