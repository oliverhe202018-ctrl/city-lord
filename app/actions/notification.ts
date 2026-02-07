'use server'

import { createClient } from '@/lib/supabase/server';

export interface Notification {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  type: 'system' | 'club' | 'mission' | 'friend';
  is_read: boolean;
  created_at: string;
}

/**
 * 发送系统通知
 */
export async function sendSystemNotification(userId: string, content: string, type: 'system' | 'club' | 'mission' | 'friend' = 'system') {
  const supabase = await createClient();
  
  try {
    const { error } = await supabase.from('messages').insert({
      sender_id: userId, // 使用用户ID作为发送者（系统通知）
      receiver_id: userId, // 接收者也是自己
      content,
      type,
      is_read: false
    });

    if (error) {
      console.error('发送系统通知失败:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('发送系统通知异常:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 获取用户的通知列表
 */
export async function getUserNotifications(userId?: string) {
  const supabase = await createClient();
  
  let targetUserId = userId;

  // 如果没有提供userId，从auth获取
  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '未登录' };
    }
    targetUserId = user.id;
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('receiver_id', targetUserId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('获取通知失败:', error);
    return { success: false, error: error.message };
  }

  return { success: true, data: data || [] };
}

/**
 * 标记通知为已读
 */
export async function markNotificationAsRead(messageId: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('id', messageId);

  if (error) {
    console.error('标记通知已读失败:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 标记所有通知为已读
 */
export async function markAllNotificationsAsRead(userId?: string) {
  const supabase = await createClient();
  
  let targetUserId = userId;

  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '未登录' };
    }
    targetUserId = user.id;
  }

  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('receiver_id', targetUserId)
    .eq('is_read', false);

  if (error) {
    console.error('标记所有通知已读失败:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 删除通知
 */
export async function deleteNotification(messageId: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId);

  if (error) {
    console.error('删除通知失败:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
