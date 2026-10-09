import { registerPlugin } from "@capacitor/core";

export interface RiderBubblePlugin {
  setSession(options: { apiKey: string; refreshToken: string }): Promise<void>;
  setOnline(options: { online: boolean }): Promise<void>;
  consumeAccepted(): Promise<{ accepted: boolean }>;
  setStatusBar(options: { color: string; lightBar: boolean }): Promise<void>;
}

// Native Android helper: floating bubble and top bar colour.
export const RiderBubble = registerPlugin<RiderBubblePlugin>("RiderBubble");