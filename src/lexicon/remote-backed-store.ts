export type RemoteBackedLoadStats = {
  count: number;
  fromRemote: boolean;
};

export type RemoteBackedStore<T> = {
  get: () => T;
  getLoadStats: () => RemoteBackedLoadStats;
  apply: (next: T) => boolean;
  resetToBundled: () => void;
};

export function createRemoteBackedStore<T>(
  bundled: T,
  countOf: (value: T) => number,
): RemoteBackedStore<T> {
  let active = bundled;
  let fromRemote = false;

  return {
    get: () => active,
    getLoadStats: () => ({ count: countOf(active), fromRemote }),
    apply(next: T) {
      if (countOf(next) === 0) return false;
      active = next;
      fromRemote = true;
      return true;
    },
    resetToBundled() {
      active = bundled;
      fromRemote = false;
    },
  };
}
