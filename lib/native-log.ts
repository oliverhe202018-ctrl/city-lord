export function logEvent(eventName: string, data?: Record<string, any>) {
  try {
    const plugin = (window as any)?.Capacitor?.Plugins?.AMapLocation;
    if (plugin && typeof plugin.logEvent === 'function') {
      plugin.logEvent({ eventName, data });
    } else {
      console.log(`[LogEvent] ${eventName}`, data ?? '');
    }
  } catch (e) {
    console.warn(`[LogEvent] failed: ${eventName}`, e);
  }
}
