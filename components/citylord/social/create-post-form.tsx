"use client"

import React, { useState, useTransition, useCallback } from "react"
import { Send, Image as ImageIcon, Smile, X, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { createPost } from "@/app/actions/social-hub"
import { handleAppError } from "@/lib/utils/app-error"

export type UploadStatus = 'idle' | 'compressing' | 'uploading' | 'uploaded' | 'failed'

export interface ImageState {
    id: string
    originalFile: File
    compressedBlob?: Blob
    status: UploadStatus
    url?: string
    error?: string
}

export function CreatePostForm({ onSuccess }: { onSuccess?: (post: any) => void }) {
    const [content, setContent] = useState("")
    const [images, setImages] = useState<ImageState[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isPending, startTransition] = useTransition()
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const supabase = createClient()

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (!files.length) return

        // Filter valid types and count
        const validFiles = files.filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type))
        if (validFiles.length < files.length) {
            toast.error("包含不支持的文件类型，仅支持 JPG/PNG/WEBP")
        }

        if (images.length + validFiles.length > 9) {
            toast.error("最多只能上传9张图片")
            return
        }

        const newImageStates: ImageState[] = validFiles.map(file => ({
            id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
            originalFile: file,
            status: 'idle'
        }))

        setImages(prev => [...prev, ...newImageStates])

        // Immediately start processing new images
        newImageStates.forEach(processImage)

        // Reset input so selecting the same file triggers again
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const processImage = async (imgState: ImageState) => {
        setImages(prev => prev.map(img => img.id === imgState.id ? { ...img, status: 'compressing', error: undefined } : img))

        let fileToUpload: Blob = imgState.originalFile

        try {
            // Compress if we don't have a cached blob
            if (!imgState.compressedBlob) {
                const options = {
                    maxSizeMB: 0.3,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                    initialQuality: 0.8,
                    fileType: imgState.originalFile.type
                }
                const imageCompression = (await import('browser-image-compression')).default
                fileToUpload = await imageCompression(imgState.originalFile, options)

                // Cache the blob
                setImages(prev => prev.map(img => img.id === imgState.id ? { ...img, compressedBlob: fileToUpload } : img))
            } else {
                fileToUpload = imgState.compressedBlob
            }

            setImages(prev => prev.map(img => img.id === imgState.id ? { ...img, status: 'uploading' } : img))

            const fileName = `${imgState.id}.${imgState.originalFile.name.split('.').pop()}`
            const filePath = `social/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('post-media')
                .upload(filePath, fileToUpload, { cacheControl: '3600', upsert: false })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(filePath)

            setImages(prev => prev.map(img => img.id === imgState.id ? { ...img, status: 'uploaded', url: publicUrl } : img))
        } catch (error: any) {
            console.error(`Upload failed for ${imgState.id}:`, error)
            setImages(prev => prev.map(img => img.id === imgState.id ? { ...img, status: 'failed', error: error.message || '网络或存储错误' } : img))
        }
    }

    const retryUpload = (id: string) => {
        const img = images.find(i => i.id === id)
        if (img) processImage(img)
    }

    const removeImage = (id: string) => {
        setImages(prev => prev.filter(img => img.id !== id))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!content.trim() && images.length === 0) return

        // Block submission if any image is actively uploading or compressing
        const isProcessing = images.some(img => img.status === 'compressing' || img.status === 'uploading')
        if (isProcessing) {
            toast.info("请等待所有图片处理完成")
            return
        }

        // Block if any failed
        const hasFailed = images.some(img => img.status === 'failed')
        if (hasFailed) {
            toast.error("有图片上传失败，请重试或移除")
            return
        }

        if (isSubmitting || isPending) return

        setIsSubmitting(true)

        try {
            const uploadedUrls = images.filter(img => img.status === 'uploaded' && img.url).map(img => img.url as string)

            startTransition(async () => {
                const res = await createPost({
                    content: content.trim(),
                    source_type: "TEXT",
                    visibility: "PUBLIC",
                    mediaUrls: uploadedUrls
                })

                if (res.error) {
                    throw new Error(res.error.message)
                }

                toast.success("发布成功！")
                setContent("")
                setImages([])
                onSuccess?.(res.post)
            })
        } catch (error: any) {
            handleAppError(error, "发布失败")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="mb-6 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm">
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="分享你的运动时刻..."
                className="w-full resize-none border-none bg-transparent text-sm text-foreground focus:outline-none focus:ring-0 placeholder:text-muted-foreground min-h-[60px]"
                maxLength={500}
                disabled={isPending || isUploading}
            />

            {images.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                    {images.map((img) => (
                        <div key={img.id} className="relative w-16 h-16 rounded-md overflow-hidden border border-border group bg-muted/30">
                            {/* Preview image using original file */}
                            <img src={URL.createObjectURL(img.originalFile)} alt="preview" className={`w-full h-full object-cover transition-opacity ${img.status === 'compressing' || img.status === 'uploading' ? 'opacity-50' : ''}`} />

                            {/* Processing Overlay */}
                            {(img.status === 'compressing' || img.status === 'uploading') && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px]">
                                    <Loader2 className="w-4 h-4 text-white animate-spin mb-1" />
                                    <span className="text-[8px] text-white font-medium">{img.status === 'compressing' ? '压缩' : '上传'}</span>
                                </div>
                            )}

                            {/* Error Overlay */}
                            {img.status === 'failed' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500/80 backdrop-blur-[1px]" title={img.error}>
                                    <AlertCircle className="w-5 h-5 text-white mb-0.5" />
                                    <button
                                        type="button"
                                        onClick={() => retryUpload(img.id)}
                                        className="text-[10px] bg-white/20 hover:bg-white/40 px-1.5 py-0.5 rounded text-white flex gap-0.5 items-center transition-colors"
                                    >
                                        <RefreshCw className="w-2.5 h-2.5" /> 重试
                                    </button>
                                </div>
                            )}

                            {/* Remove Button */}
                            <button
                                type="button"
                                onClick={() => removeImage(img.id)}
                                disabled={img.status === 'compressing' || img.status === 'uploading'}
                                className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 pointer-events-auto hover:bg-black/80 disabled:opacity-0 disabled:pointer-events-none transition-opacity opacity-0 group-hover:opacity-100"
                            >
                                <X className="w-3 h-3 text-white" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        multiple
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        disabled={isSubmitting || isPending || images.some(i => i.status === 'compressing' || i.status === 'uploading' || i.status === 'failed')}
                    />
                    <button type="button" disabled={isSubmitting || isPending} onClick={() => fileInputRef.current?.click()} className="rounded-full p-2 hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50">
                        <ImageIcon className="h-4 w-4" />
                    </button>
                    <button type="button" className="rounded-full p-2 hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50">
                        <Smile className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                        {content.length}/500
                    </span>
                    <button
                        type="submit"
                        disabled={(!content.trim() && images.length === 0) || isPending || isSubmitting || images.some(i => i.status !== 'uploaded')}
                        className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50"
                    >
                        {isPending || isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin my-auto mx-2" />
                        ) : images.some(i => i.status === 'compressing' || i.status === 'uploading') ? (
                            <span className="px-2">处理中</span>
                        ) : (
                            <>
                                <Send className="h-3 w-3" />
                                <span>发布</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </form>
    )
}
