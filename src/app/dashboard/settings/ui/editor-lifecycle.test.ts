import { describe, expect, it } from "vitest";
import { type EditorTarget, nextEditorAction } from "./editor-target";

const closed: EditorTarget = { type: "closed" };
const create: EditorTarget = { type: "create" };
const editA: EditorTarget = { type: "edit", id: "a" };
const editB: EditorTarget = { type: "edit", id: "b" };

describe("nextEditorAction", () => {
  it("is a no-op for the already-open target", () => {
    expect(nextEditorAction(editA, editA, { dirty: true, saving: false })).toBe(
      "noop",
    );
  });

  it("blocks every switch while a save is pending, even if dirty", () => {
    expect(nextEditorAction(editA, create, { dirty: true, saving: true })).toBe(
      "noop",
    );
    expect(nextEditorAction(editA, editB, { dirty: false, saving: true })).toBe(
      "noop",
    );
    expect(nextEditorAction(editA, closed, { dirty: true, saving: true })).toBe(
      "noop",
    );
  });

  it("asks before discarding a dirty panel that is not saving", () => {
    expect(
      nextEditorAction(editA, create, { dirty: true, saving: false }),
    ).toBe("confirm");
  });

  it("switches immediately when the panel is clean and idle", () => {
    expect(
      nextEditorAction(editA, editB, { dirty: false, saving: false }),
    ).toBe("apply");
    expect(
      nextEditorAction(create, closed, { dirty: false, saving: false }),
    ).toBe("apply");
  });
});
