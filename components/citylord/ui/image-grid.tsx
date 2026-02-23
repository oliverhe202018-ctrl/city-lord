"use client";

import { useState, useEffect, useCallback } from "react"
import { X, ZoomIn, ChevronLeft, ChevronRight } from "lucide-react"

interface ImageGridProps {
    urls?: string[]
}

export function ImageGrid({ urls }: ImageGridProps) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
    const [errorUrls, setErrorUrls] = useState<Set<string>>(new Set())

    // Filter invalid empty URLs
    const validUrls = urls?.filter(url => url && url.trim() !== '')

    if (!validUrls || validUrls.length === 0) return null

    const count = validUrls.length
    const gridClass = count === 1 ? "grid-cols-1" : count === 2 || count === 4 ? "grid-cols-2" : "grid-cols-3"

    return (
        <>
            <div className={`mt-3 grid gap-1.5 ${gridClass}`}>
                {validUrls.map((url, i) => (
                    <div
                        key={i}
                        className={`relative group cursor-pointer overflow-hidden rounded-lg border border-border bg-muted/50 ${count === 1 ? 'aspect-video max-h-64' : 'aspect-square'}`}
                        onClick={(e) => {
                            e.preventDefault(); e.stopPropagation();
                            if (!errorUrls.has(url)) {
                                setSelectedIndex(i);
                            }
                        }}
                    >
                        {errorUrls.has(url) ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground z-10 bg-muted/80">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 mb-2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                                <span className="text-[10px] uppercase tracking-wider opacity-50">Image Missing</span>
                            </div>
                        ) : (
                            <>
                                {/* Skeleton Background */}
                                <div className="absolute inset-0 animate-pulse bg-muted"></div>
                                <img
                                    src={url}
                                    alt="Post media"
                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 z-10"
                                    loading="lazy"
                                    decoding="async"
                                    onError={() => {
                                        setErrorUrls(prev => {
                                            const next = new Set(prev)
                                            next.add(url)
                                            return next
                                        })
                                    }}
                                />
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* Lightbox */}
            {selectedIndex !== null && (
                <ImageLightbox
                    urls={validUrls}
                    initialIndex={selectedIndex}
                    onClose={() => setSelectedIndex(null)}
                />
            )}
        </>
    )
}

interface ImageLightboxProps {
    urls: string[]
    initialIndex: number
    onClose: () => void
}

function ImageLightbox({ urls, initialIndex, onClose }: ImageLightboxProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex)

    const handlePrevious = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation()
        setCurrentIndex((prev) => (prev - 1 + urls.length) % urls.length)
    }, [urls.length])

    const handleNext = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation()
        setCurrentIndex((prev) => (prev + 1) % urls.length)
    }, [urls.length])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
            if (e.key === "ArrowLeft") handlePrevious()
            if (e.key === "ArrowRight") handleNext()
        }

        window.addEventListener("keydown", handleKeyDown)
        // Prevent background scrolling
        document.body.style.overflow = "hidden"

        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            document.body.style.overflow = ""
        }
    }, [onClose, handlePrevious, handleNext])

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200"
            onClick={onClose}
        >
            <button
                className="absolute top-6 right-6 z-[110] p-2 rounded-full bg-black/50 text-white hover:bg-black/70 hover:scale-110 active:scale-95 transition-all shadow-lg border border-white/10"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
            >
                <X className="w-6 h-6" />
            </button>

            {urls.length > 1 && (
                <>
                    <button
                        className="absolute left-4 z-[110] p-3 rounded-full bg-black/40 text-white hover:bg-black/60 hover:scale-110 active:scale-95 transition-all shadow-xl group border border-white/5"
                        onClick={handlePrevious}
                        aria-label="Previous image"
                    >
                        <ChevronLeft className="w-8 h-8 group-hover:-translate-x-0.5 transition-transform" />
                    </button>

                    <button
                        className="absolute right-4 z-[110] p-3 rounded-full bg-black/40 text-white hover:bg-black/60 hover:scale-110 active:scale-95 transition-all shadow-xl group border border-white/5"
                        onClick={handleNext}
                        aria-label="Next image"
                    >
                        <ChevronRight className="w-8 h-8 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </>
            )}

            <div className="relative w-full h-full p-4 flex items-center justify-center select-none" onClick={onClose}>
                <img
                    key={currentIndex}
                    src={urls[currentIndex]}
                    className="max-w-full max-h-[90vh] object-contain rounded-md shadow-2xl animate-in zoom-in-95 duration-300"
                    alt={`Enlarged dynamic post ${currentIndex + 1}`}
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                />
            </div>

            {urls.length > 1 && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium tracking-tight border border-white/10 pointer-events-none">
                    {currentIndex + 1} / {urls.length}
                </div>
            )}
        </div>
    )
}
