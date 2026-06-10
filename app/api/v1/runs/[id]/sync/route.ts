import { createClient } from '@/lib/supabase/server';
import { withErrorHandler, successResponse } from '@/lib/api/with-handler';
import { AppError, ErrorCode } from '@/lib/api/errors';

export const POST = withErrorHandler(async (request: Request, { params }: { params: { id: string } }) => {
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

  const body = await request.json();
  // payload should contain { currentPoint, isPaused }
  // Currently, backend uses "finish" to process the entire run, 
  // so this is a placeholder for real-time live map updates in the future.

  return successResponse({ 
    message: 'Sync received for ' + params.id
  });
});
