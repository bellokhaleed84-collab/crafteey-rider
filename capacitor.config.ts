import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crafteey.rider',
  appName: 'Crafteey Rider',
  webDir: 'out',
  server: {
    url: 'https://crafteey-rider.vercel.app',
    cleartext: false
  }
};

export default config;