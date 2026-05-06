"use client"

import { useState, useRef, useEffect } from "react"
import { Loader2, Download, Share, X } from "lucide-react"
import html2canvas from "html2canvas"
import { SafeHTML } from "./safe-html"
import { ImageGrid } from "./image-grid"
import { toast } from "sonner"

interface PosterModalProps {
    post: any
    onClose: () => void
}

export function PosterModal({ post, onClose }: PosterModalProps) {
    const [isGenerating, setIsGenerating] = useState(true)
    const [posterUrl, setPosterUrl] = useState<string | null>(null)
    const [error, setError] = useState(false)
    const posterRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Wrap in requestAnimationFrame to prevent main thread blocking during initial render calculations
        let reqId: number
        const generatePoster = () => {
            reqId = requestAnimationFrame(async () => {
                if (!posterRef.current) return
                try {
                    // Force wait for all custom fonts to finish rendering, with a 3-second timeout fallback
                    await Promise.race([
                        document.fonts.ready,
                        new Promise((resolve) => setTimeout(resolve, 3000))
                    ])

                    const html2canvas = (await import("html2canvas")).default
                    const canvas = await html2canvas(posterRef.current, {
                        useCORS: true,
                        allowTaint: true,
                        scale: window.devicePixelRatio > 1 ? 2 : 2, // Force higher scale for aliasing clarity on all devices including 320px screens
                        backgroundColor: "#0f172a", // Match app dark theme
                        onclone: (clonedDoc) => {
                            // Ensure the cloned document also awaits fonts explicitly (though document.fonts.ready above usually covers this sync)
                            clonedDoc.fonts?.ready.then(() => {
                                // optional strict internal logic placeholder
                            })
                        }
                    })
                    setPosterUrl(canvas.toDataURL("image/jpeg", 0.9))
                } catch (err) {
                    console.error("Poster generation failed:", err)
                    setError(true)
                    toast.error("海报生成失败，请重试")
                } finally {
                    setIsGenerating(false)
                }
            })
        }

        // Delay slightly to ensure images are loaded
        const timeoutDesc = setTimeout(generatePoster, 500)
        return () => {
            cancelAnimationFrame(reqId)
            clearTimeout(timeoutDesc)
        }
    }, [post])

    const handleShare = async () => {
        if (!posterUrl) return
        try {
            const blob = await (await fetch(posterUrl)).blob()
            const file = new File([blob], "citylord-poster.jpg", { type: "image/jpeg" })
            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: "我在 City Lord 的新动态",
                })
            } else {
                handleDownload()
            }
        } catch (err) {
            console.error("Share failed:", err)
            // Fallback to download if share API aborts or fails
            handleDownload()
        }
    }

    const handleDownload = () => {
        if (!posterUrl) return
        const a = document.createElement("a")
        a.href = posterUrl
        a.download = `citylord-${post.id}.jpg`
        a.click()
        toast.success("已保存到相册")
    }

    const avatar = post.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user?.nickname || "user"}`

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            {/* Invisible Poster DOM for capturing */}
            <div className="absolute top-0 left-0 -z-50 pointer-events-none opacity-0">
                <div
                    ref={posterRef}
                    className="w-[375px] bg-[#0f172a] text-white p-6 rounded-[2rem] border border-white/10"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <img src={avatar} className="w-12 h-12 rounded-full border-2 border-primary" crossOrigin="anonymous" />
                        <div>
                            <div className="font-bold text-lg">{post.user?.nickname || "City Lord"}</div>
                            <div className="text-sm text-gray-400">Lv.{post.user?.level || 1} • {new Date(post.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div className="mb-4">
                        <SafeHTML html={post.content || ""} className="text-base leading-relaxed break-words line-clamp-6 text-gray-200" />
                        {post.media_urls && post.media_urls.length > 0 && (
                            <div className="mt-3">
                                <ImageGrid urls={post.media_urls.slice(0, 4)} />
                            </div>
                        )}
                    </div>
                    <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
                        <div className="text-xs text-gray-500">City Lord - 探索你的城市</div>
                        <div className="flex gap-4">
                            <span className="text-sm text-gray-400">❤️ {post._count?.likes || 0}</span>
                            <span className="text-sm text-gray-400">💬 {post._count?.comments || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative w-full max-w-sm bg-card border border-border rounded-3xl p-6 shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-200">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-muted/50 hover:bg-muted active:scale-95 transition-all text-muted-foreground">
                    <X className="w-5 h-5" />
                </button>
                <h3 className="font-bold text-lg mb-6 text-foreground">分享动态</h3>

                {isGenerating ? (
                    <div className="w-[280px] aspect-[4/5] bg-muted/30 rounded-2xl flex flex-col items-center justify-center border border-border/50">
                        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                        <p className="text-sm text-muted-foreground animate-pulse">正在生成专属海报...</p>
                    </div>
                ) : error ? (
                    <div className="w-[280px] aspect-[4/5] bg-muted/30 rounded-2xl flex flex-col items-center justify-center border border-red-500/30">
                        <p className="text-sm text-red-400">生成失败</p>
                        <button onClick={() => { setError(false); setIsGenerating(true); }} className="mt-4 px-4 py-2 bg-muted rounded-full text-xs">重试</button>
                    </div>
                ) : (
                    <img src={posterUrl!} className="w-[280px] object-contain rounded-2xl shadow-xl shadow-black/20" alt="Generated Poster" />
                )}

                <div className="flex gap-4 w-full mt-6">
                    <button
                        disabled={isGenerating || error}
                        onClick={handleDownload}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        保存
                    </button>
                    <button
                        disabled={isGenerating || error}
                        onClick={handleShare}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <Share className="w-4 h-4" />
                        分享
                    </button>
                </div>
            </div>
        </div>
    )
}
