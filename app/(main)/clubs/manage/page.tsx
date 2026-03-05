'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getClubMembers, kickMember, setMemberRole, getClubJoinRequests, processJoinRequest } from '@/app/actions/club'
import { Loader2, ArrowLeft, UserMinus, Shield, Crown, Star, Users, ChevronDown, Check, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type RoleType = 'owner' | 'vice_president' | 'admin' | 'elite' | 'member'

const ROLE_LABELS: Record<string, string> = {
    owner: '会长',
    vice_president: '副会长',
    admin: '管理员',
    elite: '精英',
    member: '成员',
}

const ROLE_COLORS: Record<string, string> = {
    owner: 'text-yellow-400 bg-yellow-400/10',
    vice_president: 'text-orange-400 bg-orange-400/10',
    admin: 'text-blue-400 bg-blue-400/10',
    elite: 'text-purple-400 bg-purple-400/10',
    member: 'text-white/50 bg-white/5',
}

const ASSIGNABLE_ROLES: RoleType[] = ['vice_president', 'admin', 'elite', 'member']

type MemberItem = {
    userId: string
    role: string
    joinedAt: string
    user: { id: string; nickname: string; avatar_url: string | null; level: number } | null
}

type JoinRequest = {
    userId: string
    name: string
    avatar: string | null
    level: number
    appliedAt: string
}

function ManageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const clubId = searchParams.get('id')
    const [members, setMembers] = useState<MemberItem[]>([])
    const [requests, setRequests] = useState<JoinRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'members' | 'requests'>('members')
    const [expandedMember, setExpandedMember] = useState<string | null>(null)
    const [processing, setProcessing] = useState<string | null>(null)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [currentUserRole, setCurrentUserRole] = useState<string>('member')

    useEffect(() => {
        if (!clubId) return
        const supabase = createClient()

        async function loadData() {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) setCurrentUserId(user.id)

            const [memResult, reqResult] = await Promise.all([
                getClubMembers(clubId!),
                getClubJoinRequests(clubId!),
            ])

            if (memResult.success && memResult.data) {
                setMembers(memResult.data)
                // Find current user role
                const me = memResult.data.find((m: any) => m.userId === user?.id)
                if (me) setCurrentUserRole(me.role)
            }
            if (reqResult.success && reqResult.requests) {
                setRequests(reqResult.requests)
            }
            setLoading(false)
        }

        loadData()
    }, [clubId])

    const handleKick = async (userId: string, name: string) => {
        if (!clubId || !confirm(`确定要将 ${name} 移出俱乐部吗？`)) return
        setProcessing(userId)
        const result = await kickMember(clubId, userId)
        setProcessing(null)
        if (result.success) {
            toast.success(`已将 ${name} 移出俱乐部`)
            setMembers(prev => prev.filter(m => m.userId !== userId))
        } else {
            toast.error(result.error || '操作失败')
        }
    }

    const handleSetRole = async (userId: string, newRole: RoleType) => {
        if (!clubId) return
        setProcessing(userId)
        const result = await setMemberRole(clubId, userId, newRole)
        setProcessing(null)
        if (result.success) {
            toast.success(result.message)
            setMembers(prev => prev.map(m =>
                m.userId === userId ? { ...m, role: newRole } : m
            ))
            setExpandedMember(null)
        } else {
            toast.error(result.error || '操作失败')
        }
    }

    const handleRequest = async (userId: string, action: 'approve' | 'reject') => {
        if (!clubId) return
        setProcessing(userId)
        const result = await processJoinRequest(clubId, userId, action)
        setProcessing(null)
        if (result.success) {
            toast.success(action === 'approve' ? '已通过申请' : '已拒绝申请')
            setRequests(prev => prev.filter(r => r.userId !== userId))
            if (action === 'approve') {
                // Refresh member list
                const memResult = await getClubMembers(clubId)
                if (memResult.success && memResult.data) setMembers(memResult.data)
            }
        } else {
            toast.error(result.error || '操作失败')
        }
    }

    const canModifyMember = (memberRole: string) => {
        const hierarchy: Record<string, number> = { owner: 4, vice_president: 3, admin: 2, elite: 1, member: 0 }
        return (hierarchy[currentUserRole] ?? 0) > (hierarchy[memberRole] ?? 0)
    }

    if (!clubId) {
        return <div className="h-screen bg-black flex items-center justify-center text-white">缺少俱乐部信息</div>
    }

    if (loading) {
        return <div className="h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin w-8 h-8" /></div>
    }

    // Sort members: owner → vice_president → admin → elite → member
    const roleOrder: Record<string, number> = { owner: 0, vice_president: 1, admin: 2, elite: 3, member: 4 }
    const sortedMembers = [...members].sort((a, b) => (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99))

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center gap-3">
                <button onClick={() => window.history.back()} className="p-1.5 rounded-full hover:bg-white/10">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-base font-bold">俱乐部管理</h1>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-white/10">
                <button
                    onClick={() => setActiveTab('members')}
                    className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${activeTab === 'members' ? 'text-white border-b-2 border-yellow-500' : 'text-white/50'}`}
                >
                    <Users className="w-4 h-4 inline mr-1" />
                    成员管理 ({members.length})
                </button>
                <button
                    onClick={() => setActiveTab('requests')}
                    className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${activeTab === 'requests' ? 'text-white border-b-2 border-yellow-500' : 'text-white/50'}`}
                >
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    加入申请 ({requests.length})
                </button>
            </div>

            <div className="p-4 pb-20">
                {/* Members tab */}
                {activeTab === 'members' && (
                    <div className="space-y-2">
                        {sortedMembers.map((member) => {
                            const isMe = member.userId === currentUserId
                            const isOwner = member.role === 'owner'
                            const canModify = !isMe && !isOwner && canModifyMember(member.role)
                            const isExpanded = expandedMember === member.userId

                            return (
                                <div key={member.userId} className="bg-zinc-900/60 rounded-xl border border-white/5 overflow-hidden">
                                    <div className="flex items-center justify-between px-3 py-2.5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 overflow-hidden rounded-full bg-zinc-800 flex-shrink-0">
                                                {member.user?.avatar_url ? (
                                                    <img src={member.user.avatar_url} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                                                        {(member.user?.nickname || '?')[0]}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-white flex items-center gap-1.5">
                                                    {member.user?.nickname || 'Unknown'}
                                                    {isMe && <span className="text-[10px] text-white/30">(我)</span>}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[member.role] || ROLE_COLORS.member}`}>
                                                        {ROLE_LABELS[member.role] || '成员'}
                                                    </span>
                                                    <span className="text-[10px] text-white/30">Lv.{member.user?.level || 1}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {canModify && (
                                            <button
                                                onClick={() => setExpandedMember(isExpanded ? null : member.userId)}
                                                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40"
                                            >
                                                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Expanded actions */}
                                    {isExpanded && canModify && (
                                        <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-2">
                                            {/* Role assignment */}
                                            <div className="text-[10px] text-white/40 mb-1">设置角色</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {ASSIGNABLE_ROLES.map((role) => {
                                                    // Only show roles below current user's level
                                                    const canAssign = (roleOrder[role] ?? 99) > (roleOrder[currentUserRole] ?? 99) || currentUserRole === 'owner'
                                                    if (!canAssign) return null

                                                    return (
                                                        <button
                                                            key={role}
                                                            disabled={processing === member.userId || member.role === role}
                                                            onClick={() => handleSetRole(member.userId, role)}
                                                            className={`px-2 py-1 rounded-lg text-[11px] transition-all ${member.role === role
                                                                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                                                    : 'bg-white/5 text-white/60 hover:bg-white/10 border border-transparent'
                                                                } disabled:opacity-40`}
                                                        >
                                                            {ROLE_LABELS[role]}
                                                            {member.role === role && <Check className="w-3 h-3 inline ml-0.5" />}
                                                        </button>
                                                    )
                                                })}
                                            </div>

                                            {/* Kick button */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={processing === member.userId}
                                                onClick={() => handleKick(member.userId, member.user?.nickname || 'Unknown')}
                                                className="w-full mt-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 text-xs"
                                            >
                                                {processing === member.userId ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserMinus className="w-3 h-3 mr-1" />}
                                                移出俱乐部
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Requests tab */}
                {activeTab === 'requests' && (
                    <div className="space-y-2">
                        {requests.length === 0 ? (
                            <div className="text-center py-12 text-white/30 text-sm">暂无加入申请</div>
                        ) : (
                            requests.map((req) => (
                                <div key={req.userId} className="bg-zinc-900/60 rounded-xl border border-white/5 px-3 py-2.5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 overflow-hidden rounded-full bg-zinc-800 flex-shrink-0">
                                            {req.avatar ? (
                                                <img src={req.avatar} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                                                    {req.name[0]}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-white">{req.name}</div>
                                            <div className="text-[10px] text-white/30">Lv.{req.level} · {new Date(req.appliedAt).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            disabled={processing === req.userId}
                                            onClick={() => handleRequest(req.userId, 'approve')}
                                            className="h-8 w-8 hover:bg-green-500/10 text-green-400"
                                        >
                                            {processing === req.userId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            disabled={processing === req.userId}
                                            onClick={() => handleRequest(req.userId, 'reject')}
                                            className="h-8 w-8 hover:bg-red-500/10 text-red-400"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default function ClubManagePage() {
    return (
        <Suspense fallback={<div className="h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin w-8 h-8" /></div>}>
            <ManageContent />
        </Suspense>
    )
}
