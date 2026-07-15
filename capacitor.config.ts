import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ardevlabs.admin',
  appName: 'ArLABS Admin',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
