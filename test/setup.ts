import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        back: vi.fn(),
    }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
}))

// Mock next/image
vi.mock('next/image', () => ({
    default: (props: any) => {
        // eslint-disable-next-line @next/next/no-img-element
        return React.createElement('img', { ...props, priority: undefined, fetchPriority: undefined })
    },
}))

// Mock capacitor
vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: () => false,
        isPluginAvailable: () => false,
    },
}))

vi.mock('@capacitor/geolocation', () => ({
    Geolocation: {
        getCurrentPosition: vi.fn().mockResolvedValue({ coords: { latitude: 0, longitude: 0 } }),
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
        checkPermissions: vi.fn().mockResolvedValue({ location: 'granted' }),
        requestPermissions: vi.fn().mockResolvedValue({ location: 'granted' }),
    },
}))

vi.mock('@capacitor/haptics', () => ({
    Haptics: {
        impact: vi.fn(),
        notification: vi.fn(),
        vibrate: vi.fn(),
        selectionStart: vi.fn(),
        selectionChanged: vi.fn(),
        selectionEnd: vi.fn(),
    },
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => {
    return new Proxy({}, {
        get: function (target: any, prop: string | symbol) {
            return (props: any) => React.createElement('span', { 'data-testid': `icon-${String(prop)}`, ...props })
        }
    })
})

// Mock AMap loader
vi.mock('@amap/amap-jsapi-loader', () => ({
    load: vi.fn().mockResolvedValue({
        Map: vi.fn(),
        Marker: vi.fn(),
        Polyline: vi.fn(),
        Icon: vi.fn(),
        Size: vi.fn(),
        Pixel: vi.fn(),
        plugin: vi.fn(),
        Event: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
        }
    }),
}))

vi.mock('@/lib/map/safe-amap', () => ({
    safeLoadAMap: vi.fn().mockResolvedValue({
        Map: vi.fn(),
        Marker: vi.fn(),
        Polyline: vi.fn(),
    })
}))

// Set up globals
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
})

Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
    })),
})

Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
    })),
})
