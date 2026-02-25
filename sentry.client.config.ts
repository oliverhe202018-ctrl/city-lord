import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    integrations: [
        Sentry.browserTracingIntegration(),
    ],

    // 生产环境 10% 采样，开发环境全量
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // 暂不启用 Session Replay
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // 开发环境显示 debug 信息
    debug: process.env.NODE_ENV !== "production",
});
