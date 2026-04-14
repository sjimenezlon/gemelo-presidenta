"use client";
import { useSyncExternalStore } from "react";

export type TwinState = {
  floodLevel: number; // metros sobre cauce
  showCuenca: boolean;
  showBuildings: boolean;
  showSiata: boolean;
  scenario: "actual" | "tr25" | "tr100" | "cc2050";
};

const initial: TwinState = {
  floodLevel: 0.8,
  showCuenca: true,
  showBuildings: true,
  showSiata: true,
  scenario: "actual",
};

let state: TwinState = { ...initial };
const listeners = new Set<() => void>();

export const twinStore = {
  get: () => state,
  set: (patch: Partial<TwinState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useTwin(): TwinState {
  return useSyncExternalStore(
    twinStore.subscribe,
    twinStore.get,
    twinStore.get,
  );
}
