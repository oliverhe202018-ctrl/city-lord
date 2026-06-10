import { NextResponse } from 'next/server';
import { ApiResponse } from '@/types/api';
import { AppError, ErrorCode } from './errors';

type AppRouteHandler = (req: Request, context: any) => Promise<NextResponse | Response> | NextResponse | Response;

interface HandlerOptions {
  requireAuth?: boolean;
}

/**
 * 统一 HTTP 异常捕获高阶函数
 */
export function withErrorHandler(
  handler: AppRouteHandler,
  options: HandlerOptions = { requireAuth: true }
): AppRouteHandler {
  return async (req: Request, context: any) => {
    const startTime = Date.now();
    try {
      const userId = req.headers.get('x-user-id');
      if (options.requireAuth && !userId) {
        throw new AppError(ErrorCode.AUTH_TOKEN_MISSING, 'Authentication required or token expired');
      }

      context = context || {};
      if (userId) {
        context.user = { id: userId };
      }

      // 执行真实的路由逻辑
      const response = await handler(req, context);
      return response;
    } catch (error: any) {
      console.error('[API Error]:', error);

      const timestamp = Date.now();
      const meta = { timestamp, duration: timestamp - startTime };

      // 已知的业务异常
      if (error instanceof AppError) {
        const payload: ApiResponse = {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
          meta,
        };
        return NextResponse.json(payload, { status: error.statusCode });
      }

      // Prisma 或数据库层面的未知异常（屏蔽敏感信息）
      const isPrismaError = error.name?.includes('Prisma') || error.message?.includes('Database') || error.message?.includes('SQL');
      
      const payload: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.SYS_INTERNAL_ERROR,
          message: 'An unexpected internal server error occurred.',
          details: process.env.NODE_ENV === 'development' && !isPrismaError ? error.message : undefined,
        },
        meta,
      };

      return NextResponse.json(payload, { status: 500 });
    }
  };
}

/**
 * 专为流式响应（如 SSE）设计的异常与鉴权拦截器
 * 仅作同步校验与捕获，不干涉返回的流式 Response 生命周期
 */
export function withStreamingErrorHandler(
  handler: AppRouteHandler,
  options: HandlerOptions = { requireAuth: true }
): AppRouteHandler {
  return async (req: Request, context: any) => {
    try {
      const userId = req.headers.get('x-user-id');
      if (options.requireAuth && !userId) {
        throw new AppError(ErrorCode.AUTH_TOKEN_MISSING, 'Authentication required or token expired');
      }

      context = context || {};
      if (userId) {
        context.user = { id: userId };
      }

      return await handler(req, context);
    } catch (error: any) {
      console.error('[Streaming API Error]:', error);
      const isPrismaError = error.name?.includes('Prisma') || error.message?.includes('Database') || error.message?.includes('SQL');
      
      const payload: ApiResponse = {
        success: false,
        error: {
          code: error instanceof AppError ? error.code : ErrorCode.SYS_INTERNAL_ERROR,
          message: error instanceof AppError ? error.message : 'An unexpected internal server error occurred.',
          details: process.env.NODE_ENV === 'development' && !isPrismaError ? error.message : undefined,
        },
        meta: { timestamp: Date.now(), duration: 0 },
      };

      const status = error instanceof AppError ? error.statusCode : 500;
      return NextResponse.json(payload, { status });
    }
  };
}

/**
 * 通用成功响应构造工具
 */
export function successResponse<T>(data: T, metaProps?: Record<string, any>, status = 200): NextResponse {
  const payload: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: Date.now(),
      ...metaProps,
    },
  };
  return NextResponse.json(payload, { status });
}
