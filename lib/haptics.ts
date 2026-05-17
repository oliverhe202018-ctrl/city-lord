import { safeHapticImpact, safeHapticVibrate } from "@/lib/capacitor/safe-plugins"

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light') {
  safeHapticImpact(style)
}

export function hapticVibrate() {
  safeHapticVibrate()
}
