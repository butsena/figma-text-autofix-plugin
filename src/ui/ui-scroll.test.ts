import { afterEach, describe, expect, it, vi } from "vitest";
import { captureScrollTop, restoreScrollTop, restoreScrollTopSoon } from "./ui-scroll";

describe("ui-scroll", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("возвращает прокрутку после сброса", () => {
    const el = { scrollTop: 240 };
    vi.stubGlobal("document", {
      scrollingElement: el,
      documentElement: el,
      body: el,
    });
    captureScrollTop();
    el.scrollTop = 0;
    restoreScrollTop();
    expect(el.scrollTop).toBe(240);
  });

  it("не поднимает отчёт, если прокрутки не было", () => {
    const el = { scrollTop: 0 };
    vi.stubGlobal("document", {
      scrollingElement: el,
      documentElement: el,
      body: el,
    });
    captureScrollTop();
    restoreScrollTop();
    expect(el.scrollTop).toBe(0);
  });

  it("повторно ставит прокрутку после кадра и короткой паузы", () => {
    vi.useFakeTimers();
    const el = { scrollTop: 180 };
    const frames: Array<() => void> = [];
    vi.stubGlobal("document", {
      scrollingElement: el,
      documentElement: el,
      body: el,
    });
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
      frames.push(cb);
      return frames.length;
    });
    captureScrollTop();
    el.scrollTop = 0;
    restoreScrollTopSoon();
    expect(el.scrollTop).toBe(0);
    frames[0]?.();
    expect(el.scrollTop).toBe(180);
    el.scrollTop = 0;
    vi.advanceTimersByTime(80);
    expect(el.scrollTop).toBe(180);
  });
});
