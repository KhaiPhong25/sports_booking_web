import { describe, expect, it } from "vitest";
import { icon } from "./icons.js";

describe("icon", () => {
  it("renders decorative SVG icons without exposing them to assistive technology", () => {
    const markup = icon("search", "control-icon");

    expect(markup).toContain("<svg");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('class="control-icon"');
  });

  it("returns no markup for names outside the internal icon set", () => {
    expect(icon("missing")).toBe("");
  });
});
