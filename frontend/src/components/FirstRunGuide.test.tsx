// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FirstRunGuide } from "./FirstRunGuide";

describe("FirstRunGuide", () => {
  it("explains the core workflow and dismisses from its primary action", async () => {
    const onClose = vi.fn();
    render(<FirstRunGuide onClose={onClose}/>);
    expect(screen.getByRole("dialog").textContent).toContain("Search the evidence");
    expect(screen.getByRole("dialog").textContent).toContain("organisation");
    await userEvent.click(screen.getByRole("button", { name: "Begin encounter" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("connects a workspace during first boot", async () => {
    const onClose = vi.fn();
    const onBrowse = vi.fn().mockResolvedValue("/Users/test/Github");
    const onConnect = vi.fn().mockResolvedValue(2);
    const setupGuide = render(<FirstRunGuide setupRequired workspace="/Users/test/code" onBrowse={onBrowse} onConnect={onConnect} onClose={onClose}/>);

    await userEvent.click(setupGuide.getByRole("button", { name: "Browse…" }));
    expect((setupGuide.getByRole("textbox", { name: "Repository workspace" }) as HTMLInputElement).value).toBe("/Users/test/Github");
    await userEvent.click(setupGuide.getByRole("button", { name: "Connect workspace" }));

    expect(onConnect).toHaveBeenCalledWith("/Users/test/Github");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
