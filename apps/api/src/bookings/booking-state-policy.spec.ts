import {
  BookingStatePolicy,
  BookingTransitionError,
} from "./booking-state-policy";

describe("BookingStatePolicy", () => {
  const policy = new BookingStatePolicy();

  it.each([
    [null, "PENDING"],
    [null, "CONFIRMED"],
    ["PENDING", "CONFIRMED"],
    ["PENDING", "REJECTED"],
    ["PENDING", "EXPIRED"],
    ["PENDING", "CANCELLED"],
    ["CONFIRMED", "CANCELLED"],
    ["CONFIRMED", "COMPLETED"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(() => policy.assertTransition(from, to)).not.toThrow();
  });

  it.each([
    ["REJECTED", "CONFIRMED"],
    ["EXPIRED", "CONFIRMED"],
    ["CANCELLED", "PENDING"],
    ["COMPLETED", "CANCELLED"],
    ["CONFIRMED", "REJECTED"],
  ] as const)("rejects %s -> %s", (from, to) => {
    expect(() => policy.assertTransition(from, to)).toThrow(
      BookingTransitionError,
    );
  });

  it("maps only pending and confirmed to occupying state", () => {
    expect(policy.occupiesCourt("PENDING")).toBe(true);
    expect(policy.occupiesCourt("CONFIRMED")).toBe(true);
    expect(policy.occupiesCourt("EXPIRED")).toBe(false);
    expect(policy.occupiesCourt("CANCELLED")).toBe(false);
  });
});
