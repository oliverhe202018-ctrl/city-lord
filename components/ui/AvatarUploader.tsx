'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Upload, Camera } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ImageCropperModal } from './ImageCropperModal'

interface AvatarUploaderProps {
  currentAvatarUrl?: string | null
  onUploadComplete: (url: string) => void
  size?: number
  className?: string
  loading?: boolean
  children?: React.ReactNode
  cropShape?: 'round' | 'rect'
}

export function AvatarUploader({
  currentAvatarUrl,
  onUploadComplete,
  size = 100,
  className,
  loading = false,
  children,
  cropShape = 'round'
}: AvatarUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [cropperOpen, setCropperOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('请上传图片文件')
      return
    }

    // Read file as data URL for the cropper
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      setSelectedImage(reader.result as string)
      setCropperOpen(true)
    })
    reader.readAsDataURL(file)
    
    // Reset input value so the same file can be selected again
    event.target.value = ''
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    try {
      setIsUploading(true)
      
      // Convert blob to file-like object for upload path
      // Note: we just need a unique name
      const fileExt = 'jpg' // canvasUtils exports as jpeg
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedBlob, {
            contentType: 'image/jpeg',
            upsert: true
        })

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
      setCropperOpen(false)
      setSelectedImage(null)
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
             <img 
               src={currentAvatarUrl} 
               alt="Avatar" 
               className="w-full h-full object-cover transition-opacity group-hover:opacity-75"
             />
           ) : (
             <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
               <Camera className="h-1/3 w-1/3" />
             </div>
           )}
           
           <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
             <Camera className="h-6 w-6 text-white" />
           </div>

           {isLoading && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
             </div>
           )}
        </div>
      )}

      {selectedImage && (
        <ImageCropperModal
            isOpen={cropperOpen}
            onClose={() => {
                setCropperOpen(false)
                setSelectedImage(null)
            }}
            imageSrc={selectedImage}
            onCropComplete={handleCropComplete}
            cropShape={cropShape}
            aspect={1}
        />
      )}
    </div>
  )
}
