'use server'

import { createClient } from '@/lib/supabase/server';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
  data?: any;
}

/**
 * 发送系统通知
 */
export async function sendSystemNotification(userId: string, title: string, body: string, type: string = 'system', data?: any) {
  const supabase = await createClient();
  
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      body,
      type,
      data,
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

  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '未登录' };
    }
    targetUserId = user.id;
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', targetUserId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('获取通知失败:', error);
    return { success: false, error: error.message };
  }

  return { success: true, data: (data || []) as Notification[] };
}

/**
 * 获取用户未读通知数
 */
export async function getUnreadNotificationCount(userId?: string) {
  const supabase = await createClient();
  
  let targetUserId = userId;

  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;
    targetUserId = user.id;
  }

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', targetUserId)
    .eq('is_read', false);

  if (error) {
    console.error('获取未读通知数失败:', error);
    return 0;
  }

  return count || 0;
}

/**
 * 标记通知为已读
 */
export async function markNotificationAsRead(notificationId: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

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
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', targetUserId)
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
export async function deleteNotification(notificationId: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('删除通知失败:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
