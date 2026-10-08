import { describe, expect, it } from "vitest";
import { classifyLoginIdentifier, isValidUsername, suggestUsername } from "./loginIdentifier";

describe("login identifier", () => {
  it("treats digits as a Member ID", () => {
    expect(classifyLoginIdentifier("3177")).toEqual({ kind: "member_id", value: "3177" });
    expect(classifyLoginIdentifier(" #31 77 ")).toEqual({ kind: "member_id", value: "3177" });
    expect(classifyLoginIdentifier("123")).toBeNull();
  });

  it("treats letters as a case-insensitive username", () => {
    expect(classifyLoginIdentifier("@Jean.Tremblay")).toEqual({ kind: "username", value: "jean.tremblay" });
    expect(classifyLoginIdentifier("1jean")).toBeNull();
  });

  it("never accepts an email address", () => {
    expect(classifyLoginIdentifier("jean@example.com")).toBeNull();
  });

  it("validates and suggests usernames", () => {
    expect(isValidUsername("jean.tremblay")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(suggestUsername("Élise Côté-Roy")).toBe("elise.cote-roy");
    expect(suggestUsername("42")).toBe("");
  });
});
