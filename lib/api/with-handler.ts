import { NextResponse } from 'next/server';
import { ApiResponse } from '@/types/api';
import { AppError, ErrorCode } from './errors';

type AppRouteHandler = (req: Request, context: any) => Promise<NextResponse | Response> | NextResponse | Response;

/**
 * 统一 HTTP 异常捕获高阶函数
 */
export function withErrorHandler(handler: AppRouteHandler): AppRouteHandler {
  return async (req: Request, context: any) => {
    const startTime = Date.now();
    try {
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
