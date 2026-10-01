import { Capacitor } from "@capacitor/core";

// Puente expuesto por el preload de Electron (desktop/preload.cjs). Solo existe
// en la versión de escritorio (Linux / Windows).
export interface DesktopBridge {
  loadData(): Promise<string | null>;
  saveData(json: string): Promise<void>;
  dataPath(): Promise<string>;
  googleSignIn(opts: { clientId: string }): Promise<{ code: string; redirectUri: string; codeVerifier: string }>;
  googleFetch(req: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<{ status: number; body: string }>;
  openExternal(url: string): Promise<void>;
  saveFile(opts: { defaultName: string; content: string }): Promise<string | null>;
}

declare global {
  interface Window {
    gestorDesktop?: DesktopBridge;
  }
}

export const desktop: DesktopBridge | undefined = typeof window !== "undefined" ? window.gestorDesktop : undefined;

export type PlatformName = "desktop" | "android" | "web";

export const platform: PlatformName = desktop
  ? "desktop"
  : Capacitor.getPlatform() === "android"
    ? "android"
    : "web";

export function openExternal(url: string) {
  if (desktop) return desktop.openExternal(url);
  window.open(url, "_blank", "noopener");
}
