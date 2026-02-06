// global.d.ts
export {};

declare global {
  interface Window {
    AndroidApp?: {
      startLocation: () => void;
      showToast?: (msg: string) => void;
    };
    onNativeLocationSuccess?: (lat: number, lng: number, address: string) => void;
    onNativeLocationError?: (err: string) => void;
  }
}