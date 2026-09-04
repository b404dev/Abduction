// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Splash } from "./Splash";

describe("Splash", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reveals the encounter after the ship animation and starts on Enter", () => {
    const onComplete = vi.fn();
    render(<Splash onComplete={onComplete}/>);

    expect(screen.queryByRole("button", { name: /Press Enter/ })).toBeNull();
    act(() => { vi.advanceTimersByTime(1600); });
    expect(screen.getByRole("button", { name: /Press Enter/ })).toBeTruthy();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("starts when the splash is clicked anywhere", () => {
    const onComplete = vi.fn();
    render(<Splash onComplete={onComplete}/>);

    fireEvent.click(screen.getByRole("main"));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("auto-starts five seconds after launch", () => {
    const onComplete = vi.fn();
    render(<Splash onComplete={onComplete}/>);

    act(() => { vi.advanceTimersByTime(4999); });
    expect(onComplete).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
