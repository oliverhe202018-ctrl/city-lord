import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // 生产环境 10% 采样
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    debug: process.env.NODE_ENV !== "production",
});
