// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Repo } from "../../types";
import { ReviewsView } from "./RepositoryViews";

const apiMocks = vi.hoisted(() => ({
  pullRequests: vi.fn(),
  pullRequestDetail: vi.fn(),
  openURL: vi.fn(),
}));

vi.mock("../../api", () => ({ api: apiMocks }));

const repository: Repo = { name: "Abduction", owner: "b404dev", fullName: "b404dev/Abduction", path: "/tmp/Abduction", branch: "main", language: "Go", updated: "", githubUrl: "https://github.com/b404dev/Abduction", description: "" };

describe("ReviewsView", () => {
  it("filters by author and drills into the selected pull request diff", async () => {
    apiMocks.pullRequests.mockResolvedValue([
      { number: 7, title: "Refactor modules", author: "alice", state: "OPEN", draft: false, updated: "2026-09-01T00:00:00Z", url: "https://example.test/7", headBranch: "refactor", baseBranch: "main" },
      { number: 8, title: "Improve stats", author: "bob", state: "OPEN", draft: false, updated: "2026-09-01T00:00:00Z", url: "https://example.test/8", headBranch: "stats", baseBranch: "main" },
    ]);
    apiMocks.pullRequestDetail.mockResolvedValue({ number: 8, title: "Improve stats", author: "bob", state: "OPEN", draft: false, updated: "2026-09-01T00:00:00Z", url: "https://example.test/8", headBranch: "stats", baseBranch: "main", body: "Adds visual summaries.", additions: 20, deletions: 4, changedFiles: 1, commits: 2, reviewDecision: "APPROVED", mergeable: "MERGEABLE", files: [{ path: "stats.go", additions: 20, deletions: 4 }], diff: "diff --git a/stats.go b/stats.go\n+new chart" });

    render(<ReviewsView repo={repository} onError={vi.fn()}/>);
    await screen.findByText(/#7 Refactor modules/);
    await userEvent.type(screen.getByRole("textbox", { name: "Search pull requests" }), "bob");
    expect(screen.queryByText(/Refactor modules/)).toBeNull();
    await userEvent.click(screen.getByText(/#8 Improve stats/));

    await waitFor(() => expect(apiMocks.pullRequestDetail).toHaveBeenCalledWith(repository.path, 8));
    expect(await screen.findByText("stats.go")).toBeTruthy();
    expect(screen.getByText("+new chart")).toBeTruthy();
  });
});
