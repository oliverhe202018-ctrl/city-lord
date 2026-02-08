"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Upload, Loader2, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitFeedback } from "./actions";

export default function FeedbackPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片大小不能超过 5MB");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const removeImage = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    
    try {
      const result = await submitFeedback(null, formData);

      if (result?.success) {
        toast.success("反馈提交成功！感谢您的帮助");
        // Delay redirect slightly
        setTimeout(() => {
          router.back();
        }, 1500);
      } else {
        toast.error(result?.message || "提交失败");
        if (result?.error) {
           // Handle specific field errors if needed
           console.error(result.error);
        }
        setIsSubmitting(false);
      }
    } catch (error) {
      toast.error("发生意外错误");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-black text-white">
      {/* Navbar */}
      <div className="flex items-center px-4 py-4 border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <button 
          onClick={() => router.back()} 
          className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="ml-2 text-lg font-bold">问题反馈</h1>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 max-w-md mx-auto w-full">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Problem Description */}
          <div className="space-y-2">
            <label htmlFor="content" className="text-sm font-medium text-white/70">
              问题描述 <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="content"
              name="content"
              placeholder="请详细描述您遇到的问题，发生场景等..."
              className="bg-zinc-900/50 border-white/10 min-h-[150px] resize-none focus:border-yellow-500/50"
              required
              minLength={5}
            />
          </div>

          {/* Screenshot Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">
              问题截图 (选填)
            </label>
            
            <input
              type="file"
              name="screenshot"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {!previewUrl ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-yellow-500/30 hover:bg-white/5 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3 group-hover:bg-zinc-700">
                  <ImageIcon className="w-6 h-6 text-white/50" />
                </div>
                <span className="text-sm text-white/50">点击上传截图</span>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden border border-white/10 group">
                <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Contact Info */}
          <div className="space-y-2">
            <label htmlFor="contact_info" className="text-sm font-medium text-white/70">
              联系方式 <span className="text-red-500">*</span>
            </label>
            <Input
              id="contact_info"
              name="contact_info"
              type="text"
              placeholder="手机号 / 微信号 / 邮箱"
              className="bg-zinc-900/50 border-white/10 h-12 focus:border-yellow-500/50"
              required
            />
            <p className="text-xs text-white/30">方便我们进一步与您联系解决问题</p>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <Button 
              type="submit" 
              className="w-full h-12 bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-lg rounded-xl"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  提交中...
                </>
              ) : (
                "提交反馈"
              )}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}
