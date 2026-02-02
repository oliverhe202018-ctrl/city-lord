import { useCallback } from 'react'
import html2canvas from 'html2canvas'
import { toast } from 'sonner'

export function useShareCard() {
  /**
   * Generates an image from a DOM element and downloads it or shares it.
   * @param elementId The ID of the DOM element to capture (e.g., "share-card")
   * @param fileName The filename for the download
   */
  const generateImage = useCallback(async (elementId: string, fileName: string = 'run-share.png') => {
    const element = document.getElementById(elementId)
    if (!element) {
      toast.error("未找到分享卡片元素")
      return
    }

    try {
      const canvas = await html2canvas(element, {
        scale: 3, // High quality
        useCORS: true, // For external images (avatar etc)
        backgroundColor: null, // Transparent bg if element has border radius
        logging: false,
      })

      const dataUrl = canvas.toDataURL('image/png')
      
      // Check if Web Share API is supported and can share files
      if (navigator.share) {
         try {
             const blob = await (await fetch(dataUrl)).blob();
             const file = new File([blob], fileName, { type: 'image/png' });
             
             if (navigator.canShare && navigator.canShare({ files: [file] })) {
                 await navigator.share({
                     title: '我的城市领主跑步记录',
                     text: '快来看看我在城市领主中的最新战绩！',
                     files: [file]
                 });
                 toast.success("分享成功！");
                 return;
             }
         } catch (shareError) {
             console.log("Web Share API failed, falling back to download", shareError);
             // Fallback to download
         }
      }

      // Fallback: Download Link
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success("图片已保存！")
    } catch (error) {
      console.error("Capture failed:", error)
      toast.error("生成图片失败")
    }
  }, [])

  return { generateImage }
}
