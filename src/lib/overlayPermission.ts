import { registerPlugin } from "@capacitor/core";

export interface OverlayPermissionPlugin {
  canDraw(): Promise<{ granted: boolean }>;
  open(): Promise<void>;
}

// Native Android helper for "Display over other apps".
export const OverlayPermission = registerPlugin<OverlayPermissionPlugin>("OverlayPermission");