export type SystemMessageType = 'revenue' | 'combat_alert' | 'system'

export interface SystemMessage {
  id: string
  type: SystemMessageType
  title: string
  content: string
  createdAt: string
  isRead: boolean
  metadata?: Record<string, unknown>
}
