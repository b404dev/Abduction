// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fuzzyFilter, fuzzyScore, markTextMatches, regexError } from "./search";

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

  it("matches ordered characters and ranks tight filename matches first", () => {
    expect(fuzzyScore("frontend/src/FirstRunGuide.tsx", "frg")).not.toBeNull();
    expect(fuzzyScore("frontend/src/App.tsx", "frg")).toBeNull();
    expect(fuzzyFilter(["some/far/repository-guide.md", "src/repo.go"], "rgo", (value) => value)[0]).toBe("src/repo.go");
  });
});
