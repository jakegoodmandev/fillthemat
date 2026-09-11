import { describe, expect, it } from "vitest";
import { splitWhatsAppText } from "./text";

describe("splitWhatsAppText", () => {
  it("returns an empty list for blank text", () => {
    expect(splitWhatsAppText("   ")).toEqual([]);
  });

  it("keeps short text as a single chunk", () => {
    expect(splitWhatsAppText("hello")).toEqual(["hello"]);
  });

  it("splits long text into limit-sized chunks", () => {
    const text = "a".repeat(5000);
    const chunks = splitWhatsAppText(text, 4096);
    expect(chunks).toEqual(["a".repeat(4096), "a".repeat(904)]);
  });
});
