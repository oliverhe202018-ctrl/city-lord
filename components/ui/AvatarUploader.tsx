'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Upload, Camera } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface AvatarUploaderProps {
  currentAvatarUrl?: string | null
  onUploadComplete: (url: string) => void
  size?: number
  className?: string
  loading?: boolean
  children?: React.ReactNode
}

export function AvatarUploader({
  currentAvatarUrl,
  onUploadComplete,
  size = 100,
  className,
  loading = false,
  children
}: AvatarUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('请上传图片文件')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('图片大小不能超过 2MB')
      return
    }

    try {
      setIsUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      
      onUploadComplete(data.publicUrl)
      toast.success('头像上传成功')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('上传失败，请重试')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const isLoading = isUploading || loading

  return (
    <div className={cn("relative inline-block", className)}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
        disabled={isLoading}
      />
      
      {children ? (
        <div onClick={() => !isLoading && fileInputRef.current?.click()} className="cursor-pointer">
          {children}
          {isLoading && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
             </div>
          )}
        </div>
      ) : (
        <div 
          className="relative group cursor-pointer overflow-hidden rounded-full bg-muted border border-border shrink-0"
          style={{ width: size, height: size }}
          onClick={() => !isLoading && fileInputRef.current?.click()}
        >
          {currentAvatarUrl ? (
            <Image
              src={currentAvatarUrl}
              alt="Avatar"
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary/50">
              <Camera className="h-1/3 w-1/3 text-muted-foreground" />
            </div>
          )}

          {/* Overlay */}
          <div className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity",
            isLoading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            ) : (
              <Upload className="h-6 w-6 text-white" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
