import { createClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';
import { withErrorHandler, successResponse } from '@/lib/api/with-handler';
import { AppError, ErrorCode } from '@/lib/api/errors';

export const POST = withErrorHandler(async (request: Request) => {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined;

  if (!token) {
    throw new AppError(ErrorCode.AUTH_UNAUTHORIZED, '未提供访问令牌');
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new AppError(ErrorCode.AUTH_UNAUTHORIZED, '令牌无效或已过期');
  }

  // Generate a unique ID for the client to track this run locally
  // And use it as the idempotency_key when they call /api/v1/runs/[id]/finish
  const runId = randomUUID();

  return successResponse({
    runId,
    userId: user.id,
    startTime: Date.now()
  });
});
