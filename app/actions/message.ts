'use server'

import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/supabase'

type Message = Database['public']['Tables']['messages']['Row']

/**
 * @deprecated System messages have been migrated to the `notifications` table.
 * Use `sendSystemNotification()` from `@/app/actions/notification` instead.
 * The `messages` table is now strictly reserved for real Private Chat only.
 */
export async function createSystemMessage(receiverId: string, content: string) {
  // Route all system messages to the notifications table
  const { sendSystemNotification } = await import('./notification')
  return sendSystemNotification(receiverId, '系统消息', content, 'system')
}

interface AudioInfo {
  audioUrl: string;
  durationMs: number;
  mimeType: string;
  sizeBytes: number;
}

export async function sendMessage(receiverId: string, content: string, type: 'text' | 'system' | 'challenge' | 'voice' = 'text', audioInfo?: AudioInfo) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' };

  if (type === 'voice') {
    if (!audioInfo || !audioInfo.audioUrl) {
      return { error: 'Voice message missing audio payload' };
    }
    // durationMs only used as weak validation/display info
    if (audioInfo.durationMs < 800 || audioInfo.durationMs > 60000) {
      return { error: 'Voice message duration out of bounds' };
    }
    if (!audioInfo.audioUrl.startsWith(`private/${user.id}/${receiverId}/`)) {
      return { error: 'Invalid voice message storage path' };
    }

    // Verify file exists in storage and check actual size/mime
    const pathParts = audioInfo.audioUrl.split('/');
    const fileName = pathParts.pop();
    const folderPath = pathParts.join('/');

    // Explicitly target the exact folder without full-text fuzzy
    const { data: files, error: filesError } = await supabase.storage.from('voice-messages').list(folderPath, {
      limit: 1, // Since files are UUID timestamp names in strict private paths, a direct listing is safe
      search: fileName
    });

    if (filesError || !files || files.length === 0) {
      return { error: 'Voice message file not found in storage' };
    }

    const fileMeta = files.find(f => f.name === fileName);
    if (!fileMeta || !fileMeta.metadata) {
      return { error: 'Failed to retrieve voice message metadata' };
    }

    if (fileMeta.metadata.size > 1024 * 1024) { // 1MB exact check
      return { error: 'Voice message size exceeds 1MB limit' };
    }

    const allowedMimeTypes = ['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/aac', 'audio/m4a'];
    const actualMimeParams = fileMeta.metadata.mimetype.split(';')[0];
    if (!allowedMimeTypes.some(t => t.startsWith(actualMimeParams))) {
      return { error: `Unsupported audio format: ${fileMeta.metadata.mimetype}` };
    }
  }

  const { data: message, error } = await (supabase
    .from('messages' as any) as any)
    .insert({
      sender_id: user.id,
      user_id: receiverId,
      content,
      type,
      audio_url: audioInfo?.audioUrl,
      duration_ms: audioInfo?.durationMs,
      mime_type: audioInfo?.mimeType,
      size_bytes: audioInfo?.sizeBytes
    })
    .select()
    .single()

  if (error) return { error: error.message };
  return { data: message };
}

export async function getMessages() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: messages, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!sender_id(nickname, avatar_url)
    `)
    .or(`sender_id.eq.${user.id},user_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching messages:', error)
    return []
  }

  return messages
}

export async function markAsRead(messageId: string) {
  const supabase = await createClient()

  const { error } = await (supabase
    .from('messages' as any) as any)
    .update({ is_read: true })
    .eq('id', messageId)

  if (error) throw error
  return { success: true }
}

export async function getUnreadMessageCount() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)
    .neq('type', 'system')

  if (error) {
    return 0
  }

  return count || 0
}
