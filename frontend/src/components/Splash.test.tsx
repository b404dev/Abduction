// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Splash } from "./Splash";

describe("Splash", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reveals the encounter after the ship animation and starts on Enter", () => {
    const onComplete = vi.fn();
    render(<Splash onComplete={onComplete}/>);

    expect(screen.queryByRole("button", { name: /Press Enter/ })).toBeNull();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByRole("button", { name: /Press Enter/ })).toBeTruthy();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("auto-starts five seconds after revealing the encounter", () => {
    const onComplete = vi.fn();
    render(<Splash onComplete={onComplete}/>);

    act(() => { vi.advanceTimersByTime(7999); });
    expect(onComplete).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
