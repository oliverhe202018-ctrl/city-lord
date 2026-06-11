import { saveRunActivity } from '@/app/actions/run-service';
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
  const { runData, clubId } = body;

  if (!runData || (!runData.path && !runData.pathPoints)) {
    throw new AppError(ErrorCode.REQ_BAD_PARAM, '跑步数据不完整');
  }

  // Inject the ID from the URL into runData if it's not present or to enforce URL parity
  const normalizedRunData = {
    ...runData,
    pathPoints: runData.pathPoints ?? runData.path,
    idempotencyKey: params.id,
  };

  // Call the heavy backend function
  const result = await saveRunActivity(user.id, normalizedRunData, clubId);
  
  return successResponse(result);
});
