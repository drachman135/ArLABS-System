import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ardevlabs.admin',
  appName: 'ArLABS Admin',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // Capacitor Network plugin — digunakan untuk deteksi online/offline di Android
    Network: {},
  }
};

export default config;
