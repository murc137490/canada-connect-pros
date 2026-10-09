import { describe, expect, it } from "vitest";
import { safeHttpUrl } from "./safeUrl";

describe("safeHttpUrl", () => {
  it("accepts http(s)", () => {
    expect(safeHttpUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
  });
  it("rejects dangerous schemes", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl(" JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeHttpUrl("java\tscript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeHttpUrl("vbscript:msgbox")).toBeNull();
    expect(safeHttpUrl("//evil.example")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
  });
  it("optionally assumes https for bare domains", () => {
    expect(safeHttpUrl("example.com", { assumeHttps: true })).toBe("https://example.com/");
    expect(safeHttpUrl("javascript:alert(1)", { assumeHttps: true })).toBeNull();
  });
  it("optionally allows same-site paths only", () => {
    expect(safeHttpUrl("/dashboard", { allowRelative: true })).toBe("/dashboard");
    expect(safeHttpUrl("//evil.example", { allowRelative: true })).toBeNull();
    expect(safeHttpUrl("/\\evil.example", { allowRelative: true })).toBeNull();
    expect(safeHttpUrl("/dashboard")).toBeNull();
  });
});
