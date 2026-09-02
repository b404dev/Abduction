// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SecurityView } from "./OperationViews";
import type { Repo, ScannerInfo } from "../../types";

const apiMocks = vi.hoisted(() => ({
  scanners: vi.fn(),
  startScan: vi.fn(),
  cancelScan: vi.fn(),
}));

vi.mock("../../api", () => ({ api: apiMocks }));
vi.mock("../../../wailsjs/runtime/runtime", () => ({
  ClipboardSetText: vi.fn(),
  EventsOn: vi.fn(() => () => undefined),
}));

const repository: Repo = {
  name: "azure-audit-tool",
  owner: "b404dev",
  fullName: "b404dev/azure-audit-tool",
  path: "/tmp/azure-audit-tool",
  branch: "dev",
  language: "Go",
  updated: "",
  githubUrl: "https://github.com/b404dev/azure-audit-tool",
  description: "",
};

const scanners: ScannerInfo[] = [
  { name: "gitleaks", available: true, install: "Secret scanner", commands: [] },
];

describe("SecurityView", () => {
  it("starts a scan when the run button is clicked", async () => {
    apiMocks.scanners.mockResolvedValue(scanners);
    apiMocks.startScan.mockResolvedValue("scan-1");

    render(<SecurityView repo={repository} onError={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "Run gitleaks" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Run gitleaks" }));

    expect(screen.getByText("Starting gitleaks...")).toBeTruthy();
    await waitFor(() => expect(apiMocks.startScan).toHaveBeenCalledWith(repository.path, "gitleaks"));
    expect(screen.getByRole("button", { name: /Cancel scan/ })).toBeTruthy();
    expect(screen.getByText("Scanning…")).toBeTruthy();
  });
});
