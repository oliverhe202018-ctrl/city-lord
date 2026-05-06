// global.d.ts
export { };

declare global {
  interface Window {
    /** Legacy native bridge (kept for backward compat) */
    AndroidApp?: {
      startLocation: () => void;
      showToast?: (msg: string) => void;
    };
    /** Legacy native location callback */
    onNativeLocationSuccess?: (lat: number, lng: number, address: string) => void;
    onNativeLocationError?: (err: string) => void;
  }
}