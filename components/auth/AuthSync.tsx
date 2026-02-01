"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useGameStore } from "@/store/useGameStore"
import { toast } from "sonner"
import { Database } from "@/types/supabase"
import { touchUserActivity } from "@/app/actions/user"

export function AuthSync() {
  const setNickname = useGameStore((state) => state.setNickname)
  const setAvatar = useGameStore((state) => state.setAvatar)
  
  useEffect(() => {
    const supabase = createClient()
    let heartbeatInterval: NodeJS.Timeout

    // 检查初始 Session
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        
        if (session?.user) {
          // 如果有有效 Session，立即同步用户数据
          await syncUserProfile(session.user.id)
          
          // Start heartbeat immediately and then interval
          touchUserActivity().catch((e) => {
            if (e?.name !== 'AbortError' && e?.digest !== 'NEXT_REDIRECT') {
              console.error(e)
            }
          })
          heartbeatInterval = setInterval(() => {
            touchUserActivity().catch((e) => {
              if (e?.name !== 'AbortError' && e?.digest !== 'NEXT_REDIRECT') {
                console.error(e)
              }
            })
          }, 2 * 60 * 1000) // 2 minutes
        } else {
          console.log("No active session found on init")
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError' && error?.digest !== 'NEXT_REDIRECT') {
          console.error("Session init error:", error)
        }
      }
    }
    
    initSession()

    // 监听 Auth 变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        syncUserProfile(session.user.id)
        toast.success("登录成功", {
          description: "正在同步游戏数据..."
        })
        
        // Clear existing interval if any
        if (heartbeatInterval) clearInterval(heartbeatInterval)
        
        // Start heartbeat
        touchUserActivity().catch((e) => {
           if (e?.name !== 'AbortError' && e?.digest !== 'NEXT_REDIRECT') {
             console.error(e)
           }
        })
        heartbeatInterval = setInterval(() => {
          touchUserActivity().catch((e) => {
             if (e?.name !== 'AbortError' && e?.digest !== 'NEXT_REDIRECT') {
               console.error(e)
             }
          })
        }, 2 * 60 * 1000)
        
      } else if (event === "SIGNED_OUT") {
        // 可选：重置 Store
        // useGameStore.getState().resetUser()
        toast.info("已退出登录")
        if (heartbeatInterval) clearInterval(heartbeatInterval)
      }
    })

    return () => {
      subscription.unsubscribe()
      if (heartbeatInterval) clearInterval(heartbeatInterval)
    }
  }, [])

  const syncUserProfile = async (userId: string) => {
    const supabase = createClient()
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error("Error fetching profile:", error)
        return
      }

      const profile = data as Database['public']['Tables']['profiles']['Row']

      if (profile) {
        // 同步数据到 Zustand Store
        // 注意：这里我们只同步了部分字段，需要根据实际 Store 结构扩展
        if (profile.nickname) setNickname(profile.nickname)
        if (profile.avatar_url) setAvatar(profile.avatar_url)
        
        // 如果 Store 支持设置 ID、等级等，也应该同步
        // useGameStore.setState({ userId: profile.id, level: profile.level ... })
        useGameStore.setState((state) => ({
          ...state,
          userId: profile.id,
          level: profile.level || state.level,
          currentExp: profile.current_exp || state.currentExp,
          maxExp: profile.max_exp || state.maxExp,
          stamina: profile.stamina || state.stamina,
          maxStamina: profile.max_stamina || state.maxStamina,
          totalArea: profile.total_area || state.totalArea,
        }))
        
        console.log("User profile synced:", profile)
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError' && error?.digest !== 'NEXT_REDIRECT') {
        console.error("Failed to sync profile:", error)
      }
    }
  }

  return null // 这个组件不渲染任何 UI
}
