"use client";
import { useSyncExternalStore } from "react";

import type { BasemapId } from "./mapStyle";

export type OverlayId = "hot" | "nasa_precip" | "esri_hillshade" | "worldcover";

export type TwinState = {
  floodLevel: number; // metros sobre cauce
  showCuenca: boolean;
  showBuildings: boolean;
  showSiata: boolean;
  scenario: "actual" | "tr2" | "tr5" | "tr10" | "tr25" | "tr50" | "tr100" | "cc2050";
  basemap: BasemapId;
  overlays: Record<OverlayId, boolean>;
  buildingsTotal: number;
  meta: any;
  showKontur: boolean;
};

const initial: TwinState = {
  floodLevel: 0.8,
  showCuenca: true,
  showBuildings: true,
  showSiata: true,
  scenario: "actual",
  basemap: "dark",
  overlays: { hot: false, nasa_precip: false, esri_hillshade: false, worldcover: false },
  buildingsTotal: 0,
  meta: null,
  showKontur: false,
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
