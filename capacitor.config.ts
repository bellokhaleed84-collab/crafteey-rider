import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crafteey.rider',
  appName: 'Crafteey Rider',
  webDir: 'out',
  server: {
    url: 'https://crafteey-rider.vercel.app',
    cleartext: false
  },
  android: {
    // Purple while the app loads, so there is no black flash before the splash.
    backgroundColor: '#3F04AC',
    // Needed so location updates keep flowing while the phone is locked.
    useLegacyBridge: true
  }
};

export default config;