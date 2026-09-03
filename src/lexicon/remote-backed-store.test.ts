import { describe, expect, it } from "vitest";
import { createRemoteBackedStore } from "./remote-backed-store";

describe("createRemoteBackedStore", () => {
  it("возвращает bundled-значение по умолчанию", () => {
    const store = createRemoteBackedStore(["a"], (v) => v.length);
    expect(store.get()).toEqual(["a"]);
    expect(store.getLoadStats()).toEqual({ count: 1, fromRemote: false });
  });

  it("apply принимает удалённые данные и обновляет статистику", () => {
    const store = createRemoteBackedStore(["a"], (v) => v.length);
    expect(store.apply(["b", "c"])).toBe(true);
    expect(store.get()).toEqual(["b", "c"]);
    expect(store.getLoadStats()).toEqual({ count: 2, fromRemote: true });
  });

  it("apply отклоняет пустое значение", () => {
    const store = createRemoteBackedStore(["a"], (v) => v.length);
    expect(store.apply([])).toBe(false);
    expect(store.get()).toEqual(["a"]);
    expect(store.getLoadStats().fromRemote).toBe(false);
  });

  it("resetToBundled возвращает исходные данные", () => {
    const store = createRemoteBackedStore(["a"], (v) => v.length);
    store.apply(["x"]);
    store.resetToBundled();
    expect(store.get()).toEqual(["a"]);
    expect(store.getLoadStats()).toEqual({ count: 1, fromRemote: false });
  });
});
