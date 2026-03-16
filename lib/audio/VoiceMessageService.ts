import { createClient } from '@/lib/supabase/client';

/**
 * 标记语音消息已读
 * 只有接收方调用有效（RLS 保证）
 * 幂等：重复调用安全
 */
export async function markVoiceRead(messageId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('mark_voice_read', {
    p_message_id: messageId,
  });
  if (error) {
    // 已读失败不应该打断用户体验，只记录日志
    console.warn('[VoiceMessageService] markVoiceRead failed', error);
  }
}
