// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { markTextMatches, regexError } from "./search";

describe("repository search matching", () => {
  it("treats punctuation literally by default", () => {
    const root = document.createElement("div");
    root.textContent = "file.ts fileXts FILE.TS";
    const matches = markTextMatches(root, "file.ts");
    expect(matches.map((match) => match.textContent)).toEqual(["file.ts", "FILE.TS"]);
  });

  it("highlights every regular-expression match", () => {
    const root = document.createElement("div");
    root.innerHTML = "<code>tic-tac tic tac ordinary</code>";
    const matches = markTextMatches(root, "tic[ -]tac", true);
    expect(matches.map((match) => match.textContent)).toEqual(["tic-tac", "tic tac"]);
  });

  it("reports malformed expressions", () => {
    expect(regexError("[")).toContain("regular expression");
    expect(regexError("^src/.*\\.tsx$")).toBe("");
  });
});
