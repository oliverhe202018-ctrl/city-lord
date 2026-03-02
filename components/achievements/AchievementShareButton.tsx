'use client'

import { useRef, useState } from 'react'
import { Share2, Download, X, Loader2, AlertCircle } from 'lucide-react'
import type { Achievement } from '@/types/city'

interface AchievementShareButtonProps {
    achievement: Achievement
}

type ShareState = 'idle' | 'preparing' | 'capturing' | 'success' | 'failed'

/**
 * A share button for achievement cards.
 * Uses html2canvas to capture the achievement card to an image, then:
 * 1) Web Share API (mobile-first)
 * 2) Falls back to direct download on desktop
 */
export function AchievementShareButton({ achievement }: AchievementShareButtonProps) {
    const [shareState, setShareState] = useState<ShareState>('idle')
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [captureError, setCaptureError] = useState<string | null>(null)
    const cardRef = useRef<HTMLDivElement>(null)
    const currentRequestId = useRef(0)

    async function handleShare() {
        if (shareState === 'preparing' || shareState === 'capturing') return

        currentRequestId.current += 1
        const reqId = currentRequestId.current

        setShareState('preparing')
        setCaptureError(null)
        try {
            // Wait for all fonts to finish loading so html2canvas renders text correctly
            await document.fonts.ready

            // Dynamically import html2canvas to keep the bundle lean
            const html2canvas = (await import('html2canvas')).default
            if (!cardRef.current) throw new Error('Capture target not found')

            setShareState('capturing')

            // Wrap html2canvas in a timeout promise to prevent infinite hanging
            const canvasPromise = html2canvas(cardRef.current, {
                backgroundColor: '#0f172a',  // Solid dark bg avoids transparent-edge artifacts
                scale: 2,                     // Retina quality
                useCORS: true,               // Allow cross-origin images (CDN avatars, icons)
                allowTaint: false,            // Consistent with useCORS:true
                logging: false,
                imageTimeout: 5000,
                onclone: (_doc, element) => {
                    // Ensure the hidden capture target is fully visible during snapshot
                    element.style.opacity = '1'
                    element.style.position = 'static'
                },
            })

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('CAPTURE_TIMEOUT')), 10000)
            )

            const canvas = await Promise.race([canvasPromise, timeoutPromise])

            const dataUrl = canvas.toDataURL('image/png')
            if (currentRequestId.current !== reqId) return

            setPreviewUrl(dataUrl)

            // Try Web Share API first (works on mobile + Chromium)
            if (navigator.share && navigator.canShare) {
                const blob = await (await fetch(dataUrl)).blob()
                if (currentRequestId.current !== reqId) return

                const file = new File([blob], `${achievement.name}-achievement.png`, { type: 'image/png' })
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: `我在城市领主解锁了成就：${achievement.name}`,
                        text: achievement.description,
                        files: [file],
                    })
                    if (currentRequestId.current === reqId) {
                        setPreviewUrl(null) // Close preview after sharing
                        setShareState('success')
                    }
                    return
                }
            }

            // Desktop fallback: show preview modal (user can download)
            if (currentRequestId.current === reqId) {
                setShareState('success')
            }
        } catch (err: any) {
            if (currentRequestId.current !== reqId) return

            console.error('[AchievementShareButton] Error:', err)
            setShareState('failed')
            if (err.message === 'CAPTURE_TIMEOUT') {
                setCaptureError('生成超时，请检查网络或重试')
            } else {
                setCaptureError('图片生成失败，跨域资源可能受限')
            }
        }
    }

    function handleDownload() {
        if (!previewUrl) return
        const a = document.createElement('a')
        a.href = previewUrl
        a.download = `${achievement.name}-城市领主成就.png`
        a.click()
        setPreviewUrl(null)
    }

    const tierColors: Record<string, string> = {
        bronze: 'from-orange-500 to-amber-600',
        silver: 'from-gray-400 to-slate-500',
        gold: 'from-yellow-400 to-amber-500',
        platinum: 'from-cyan-400 to-blue-500',
        diamond: 'from-purple-500 to-pink-500',
    }

    const gradientClass = tierColors[achievement.tier] ?? tierColors.bronze

    return (
        <>
            {/* ── Hidden capture target (offscreen rendered but visually nice) ── */}
            <div className="absolute -z-10 opacity-0 pointer-events-none" aria-hidden>
                <div
                    ref={cardRef}
                    className={`w-72 rounded-2xl bg-gradient-to-br ${gradientClass} p-1`}
                >
                    <div className="rounded-xl bg-slate-900/90 p-5 text-center space-y-3">
                        <p className="text-5xl leading-none">{achievement.icon || '🏆'}</p>
                        <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">城市领主成就</p>
                        <h3 className="text-xl font-bold text-white">{achievement.name}</h3>
                        <p className="text-sm text-white/70">{achievement.description}</p>
                        <div className={`inline-block mt-1 px-3 py-1 rounded-full bg-gradient-to-r ${gradientClass} text-white text-xs font-bold`}>
                            {achievement.tier?.toUpperCase()}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Trigger button ── */}
            <div className="flex flex-col items-end gap-1">
                <button
                    onClick={handleShare}
                    disabled={shareState === 'preparing' || shareState === 'capturing'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
          bg-white/10 hover:bg-white/20 text-white/80 hover:text-white
          border border-white/10 transition-all active:scale-95 disabled:opacity-50"
                >
                    {(shareState === 'preparing' || shareState === 'capturing') ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <Share2 className="w-3.5 h-3.5" />
                    )}
                    {shareState === 'failed' ? '重新分享' : '分享成就'}
                </button>
                {shareState === 'failed' && captureError && (
                    <div className="flex flex-col items-end gap-1 mt-1">
                        <span className="flex items-center gap-1 text-[10px] text-red-400">
                            <AlertCircle className="w-3 h-3" />
                            {captureError}
                        </span>
                        {/* Fallback Action */}
                        <button
                            onClick={async () => {
                                const textObj = `【城市领主成就】${achievement.name}\n${achievement.description}\n快来挑战吧！`
                                try {
                                    await navigator.clipboard.writeText(textObj)
                                    alert('成就文本已复制，可前往其他应用粘贴分享')
                                } catch (e) {
                                    alert('复制失败，请尝试长按选择上方内容进行复制')
                                }
                                setShareState('idle')
                                setCaptureError(null)
                            }}
                            className="text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2"
                        >
                            改用纯文本复制分享
                        </button>
                    </div>
                )}
            </div>

            {/* ── Desktop preview modal ── */}
            {previewUrl && (
                <>
                    <div
                        className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm"
                        onClick={() => setPreviewUrl(null)}
                    />
                    <div className="fixed inset-0 z-[401] flex items-center justify-center p-4">
                        <div className="relative w-full max-w-xs rounded-2xl bg-slate-900 border border-white/10 overflow-hidden">
                            {/* Close */}
                            <button
                                onClick={() => setPreviewUrl(null)}
                                className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <X className="w-4 h-4 text-white/60" />
                            </button>

                            {/* Preview */}
                            <img src={previewUrl} alt="成就分享图" className="w-full" />

                            {/* Actions */}
                            <div className="p-4 space-y-2">
                                <button
                                    onClick={handleDownload}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
                    bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all active:scale-95"
                                >
                                    <Download className="w-4 h-4" />
                                    保存图片
                                </button>
                                <p className="text-center text-xs text-white/40">保存后可分享至微信、朋友圈等</p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}
