import { create } from 'zustand'
import type { SystemMessage, SystemMessageType } from '@/types/system-message'

interface MessageStoreState {
  systemMessages: SystemMessage[]
  isLoading: boolean
  error: string | null
  fetchSystemMessages: () => Promise<void>
  markSystemMessageRead: (id: string) => Promise<void>
}

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

type UnknownRecord = Record<string, unknown>

const toRecord = (value: unknown): UnknownRecord => {
  if (typeof value === 'object' && value !== null) {
    return value as UnknownRecord
  }
  return {}
}

const toStringValue = (value: unknown): string => (typeof value === 'string' ? value : '')

const toBooleanValue = (value: unknown): boolean => typeof value === 'boolean' && value

const toIsoString = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
  }
  return new Date().toISOString()
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const parseMetadata = (value: unknown): UnknownRecord => {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return toRecord(parsed)
    } catch {
      return {}
    }
  }
  try {
    return toRecord(value)
  } catch {
    return {}
  }
}

const mapRawToSystemMessage = (raw: unknown): SystemMessage => {
  const record = toRecord(raw)
  const metadata = parseMetadata(record.metadata)
  const lat = toFiniteNumber(metadata.lat ?? record.lat)
  const lng = toFiniteNumber(metadata.lng ?? record.lng)
  const mergedMetadata: UnknownRecord = {
    ...metadata,
    ...(lat !== null ? { lat } : {}),
    ...(lng !== null ? { lng } : {})
  }

  const title = toStringValue(record.title)
  const content = toStringValue(record.content || record.message || record.body)
  const normalizedText = [
    title,
    content,
    toStringValue(record.type),
    toStringValue(record.category),
    JSON.stringify(mergedMetadata)
  ].join(' ').toLowerCase()

  const hasAmountOrRevenue =
    Object.prototype.hasOwnProperty.call(mergedMetadata, 'amount') ||
    Object.prototype.hasOwnProperty.call(mergedMetadata, 'revenue') ||
    normalizedText.includes('revenue') ||
    normalizedText.includes('收益')

  const hasCombatKeyword = /(attack|combat|battle|raid|攻击|战斗)/i.test(normalizedText)
  const hasLatLng = lat !== null && lng !== null

  const type: SystemMessageType = hasAmountOrRevenue
    ? 'revenue'
    : (hasLatLng && hasCombatKeyword ? 'combat_alert' : 'system')

  const id = toStringValue(record.id || record.messageId) || `system_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const createdAt = toIsoString(record.createdAt ?? record.created_at ?? record.timestamp)
  const isRead = toBooleanValue(record.isRead) || toBooleanValue(record.is_read)
  const fallbackTitle = type === 'revenue' ? '领地收益通知' : (type === 'combat_alert' ? '战斗警报' : '系统通知')

  return {
    id,
    type,
    title: title || fallbackTitle,
    content: content || '你收到一条新的系统消息',
    createdAt,
    isRead,
    metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined
  }
}

export const useMessageStore = create<MessageStoreState>((set) => ({
  systemMessages: [],
  isLoading: false,
  error: null,

  fetchSystemMessages: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/messages/notifications', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`加载系统消息失败: ${response.status}`)
      }

      const payload: unknown = await response.json()
      const payloadRecord = toRecord(payload)
      const rawList = Array.isArray(payload)
        ? payload
        : Array.isArray(payloadRecord.data)
          ? payloadRecord.data
          : Array.isArray(payloadRecord.messages)
            ? payloadRecord.messages
            : Array.isArray(payloadRecord.items)
              ? payloadRecord.items
              : []
      const mapped = rawList.map(mapRawToSystemMessage)
      set({ systemMessages: mapped, isLoading: false, error: null })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载系统消息失败'
      set({ isLoading: false, error: message, systemMessages: [] })
    }
  },

  markSystemMessageRead: async (id: string) => {
    const syncLocalRead = () => {
      set((state) => ({
        systemMessages: state.systemMessages.map((msg) => (
          msg.id === id ? { ...msg, isRead: true } : msg
        ))
      }))
    }

    if (!isUuid(id)) {
      syncLocalRead()
      return
    }

    try {
      let response = await fetch('/api/messages/mark-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: id }),
        credentials: 'include'
      })

      if (!response.ok && (response.status === 404 || response.status === 405)) {
        response = await fetch('/api/message/mark-as-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: id }),
          credentials: 'include'
        })
      }

      if (!response.ok) {
        throw new Error(`标记已读失败: ${response.status}`)
      }

      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const body: unknown = await response.json()
        const bodyRecord = toRecord(body)
        if (bodyRecord.success === false) {
          throw new Error('标记已读失败')
        }
      }

      syncLocalRead()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '标记已读失败'
      set({ error: message })
    }
  }
}))
