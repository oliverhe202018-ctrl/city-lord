import * as Sentry from "@sentry/nextjs";

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        await import("./sentry.server.config");

        // 强制所有 Node.js 层的原生 fetch (包括 supabase-js 和 zeptomail) 走本地 Xray 透明代理
        if (process.env.NODE_ENV === 'production') {
            try {
                const { setGlobalDispatcher, ProxyAgent } = require('undici');
                const PROXY_URL = process.env.HTTP_PROXY || 'http://127.0.0.1:10809';
                setGlobalDispatcher(new ProxyAgent(PROXY_URL));
                console.log(`[Proxy] Global undici dispatcher injected pointing to ${PROXY_URL}`);
            } catch (e) {
                console.error('[Proxy] Failed to inject global dispatcher:', e);
            }
        }
    }

    if (process.env.NEXT_RUNTIME === "edge") {
        await import("./sentry.edge.config");
    }
}

export const onRequestError = Sentry.captureRequestError;
