import { useSyncExternalStore } from 'react';

// Bridge between the prototype's mutable `state` object and React.
// Legacy code calls render() after mutating state; React subscribes to it.
let version = 0;
const listeners = new Set();

export function render() {
  version += 1;
  listeners.forEach((l) => l());
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useStore = () => useSyncExternalStore(subscribe, () => version);
