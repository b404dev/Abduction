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
});
