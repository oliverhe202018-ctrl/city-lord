'use client'

import React, { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider' // Wait, I found no slider.tsx but user might have shadcn setup. I will check for ui components folder.
import { getCroppedImg } from '@/lib/canvasUtils'
import { Loader2, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'

// Fallback Slider if not present (I'll implement a simple one inside or just use input)
// Actually, let's just use input type="range" for simplicity and robustness if I'm not sure about the component library state.

interface ImageCropperModalProps {
  isOpen: boolean
  onClose: () => void
  imageSrc: string
  onCropComplete: (croppedBlob: Blob) => void
  aspect?: number
  cropShape?: 'rect' | 'round'
}

export function ImageCropperModal({
  isOpen,
  onClose,
  imageSrc,
  onCropComplete,
  aspect = 1,
  cropShape = 'round'
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop)
  }

  const onZoomChange = (zoom: number) => {
    setZoom(zoom)
  }

  const onCropCompleteCallback = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleSave = async () => {
    try {
      setIsProcessing(true)
      const croppedImage = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation
      )
      if (croppedImage) {
        onCropComplete(croppedImage)
        onClose()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm ${isOpen ? '' : 'hidden'}`}>
      <div className="relative w-full max-w-lg bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">编辑图片</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <span className="sr-only">Close</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="relative w-full h-[400px] bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteCallback}
            onZoomChange={onZoomChange}
            cropShape={cropShape}
            showGrid={false}
          />
        </div>

        <div className="p-6 space-y-6 bg-zinc-900">
          <div className="space-y-4">
             <div className="flex items-center gap-4">
                <ZoomOut className="w-4 h-4 text-zinc-400" />
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
                />
                <ZoomIn className="w-4 h-4 text-zinc-400" />
             </div>
             
             {/* Optional Rotation Slider or Button */}
             {/* 
             <div className="flex items-center gap-4">
                <RotateCw className="w-4 h-4 text-zinc-400" />
                <input
                  type="range"
                  value={rotation}
                  min={0}
                  max={360}
                  step={1}
                  aria-labelledby="Rotation"
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
                />
             </div>
             */}
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1 bg-transparent border-zinc-700 text-white hover:bg-zinc-800"
            >
              取消
            </Button>
            <Button 
              onClick={handleSave}
              className="flex-1 bg-white text-black hover:bg-white/90"
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              确认裁剪
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
