/**
 * networkStatus.ts
 * Hook React untuk mendeteksi status jaringan secara real-time.
 * 
 * Menggunakan Capacitor Network plugin (native Android) sebagai sumber utama,
 * dengan fallback ke navigator.onLine untuk browser/web.
 */

import { useState, useEffect } from 'react';

/** Status jaringan saat ini */
export type NetworkStatus = 'online' | 'offline' | 'unknown';

// Event name yang dipancarkan saat status berubah (digunakan untuk komunikasi global)
export const NETWORK_CHANGE_EVENT = 'arlabs:network-change';

let capacitorListenerHandle: any = null;

/**
 * Menginisialisasi listener Capacitor Network plugin.
 * Dipanggil sekali saat aplikasi pertama kali dimuat.
 */
export const initNetworkListener = async (): Promise<void> => {
  try {
    const { Network } = await import('@capacitor/network');

    // Cek status awal
    const status = await Network.getStatus();
    dispatchNetworkChange(status.connected ? 'online' : 'offline');

    // Pasang listener untuk perubahan jaringan
    capacitorListenerHandle = await Network.addListener('networkStatusChange', (networkStatus) => {
      const status = networkStatus;
      const newStatus: NetworkStatus = status.connected ? 'online' : 'offline';
      console.log(`[Network] Status changed: ${newStatus} (${status.connectionType})`);
      dispatchNetworkChange(newStatus);
    });

    console.log('[Network] Capacitor Network plugin initialized');
  } catch (err) {
    // Fallback: Capacitor tidak tersedia (berjalan di browser biasa)
    console.warn('[Network] Capacitor Network plugin not available, using browser fallback');
    setupBrowserFallback();
  }
};

/**
 * Menghapus listener jaringan. Dipanggil saat aplikasi ditutup (cleanup).
 */
export const removeNetworkListener = async (): Promise<void> => {
  if (capacitorListenerHandle) {
    await capacitorListenerHandle.remove();
    capacitorListenerHandle = null;
  }
};

/**
 * Memancarkan event perubahan jaringan ke seluruh aplikasi.
 */
const dispatchNetworkChange = (status: NetworkStatus): void => {
  window.dispatchEvent(
    new CustomEvent(NETWORK_CHANGE_EVENT, { detail: { status } })
  );
};

/**
 * Fallback untuk browser: menggunakan event online/offline bawaan browser.
 */
const setupBrowserFallback = (): void => {
  const handleOnline = () => dispatchNetworkChange('online');
  const handleOffline = () => dispatchNetworkChange('offline');
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
};

/**
 * Mengecek status jaringan saat ini secara sinkron.
 * Menggunakan navigator.onLine sebagai nilai awal yang cepat.
 */
export const getCurrentNetworkStatus = (): NetworkStatus => {
  return navigator.onLine ? 'online' : 'offline';
};

// ─────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────

/**
 * Hook untuk mendapatkan status jaringan secara reaktif di komponen React.
 * 
 * @returns `{ isOnline, isOffline, status }` — status jaringan saat ini
 * 
 * @example
 * const { isOnline, isOffline } = useNetworkStatus();
 * if (isOffline) return <OfflineBanner />;
 */
export const useNetworkStatus = () => {
  const [status, setStatus] = useState<NetworkStatus>(() => getCurrentNetworkStatus());

  useEffect(() => {
    const handleChange = (e: Event) => {
      const { status: newStatus } = (e as CustomEvent<{ status: NetworkStatus }>).detail;
      setStatus(newStatus);
    };

    window.addEventListener(NETWORK_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(NETWORK_CHANGE_EVENT, handleChange);
  }, []);

  return {
    status,
    isOnline: status === 'online',
    isOffline: status === 'offline',
  };
};
