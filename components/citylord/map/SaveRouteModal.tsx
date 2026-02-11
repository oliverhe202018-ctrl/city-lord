'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

interface SaveRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  distance: number; // km
  area: number; // km²
  initialName?: string;
  loading?: boolean;
  mode?: 'save' | 'update';
}

export default function SaveRouteModal({
  isOpen,
  onClose,
  onSave,
  distance,
  area,
  initialName = '',
  loading = false,
  mode = 'save'
}: SaveRouteModalProps) {
  const [routeName, setRouteName] = useState(initialName);

  useEffect(() => {
    if (isOpen) {
      setRouteName(initialName || '');
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!routeName.trim()) return;
    onSave(routeName);
  };

  // 🔑 阻止内容区域的点击事件冒泡
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // 🔑 点击遮罩层关闭
  const handleOverlayClick = () => {
    if (!loading) onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-auto" 
      onClick={handleOverlayClick} // 点击外部关闭
    >
      {/* 遮罩层 - 提高透明度 */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* 内容区域 - 提高亮度 */}
      <div 
        className="relative w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl overflow-hidden" 
        onClick={handleContentClick} // 🔑 阻止冒泡
      >
        {/* 头部 */}
        <div className="relative px-6 py-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white text-center">
            {mode === 'save' ? '保存路线' : '更新路线'}
          </h2>
          <p className="text-sm text-slate-400 text-center mt-1">
            {mode === 'save' ? '为你的路线起一个容易记住的名字。' : '更新你的路线名称。'}
          </p>
          
          {/* 关闭按钮 */}
          <button 
            onClick={onClose}
            disabled={loading}
            className="absolute top-4 right-4 p-2 rounded-lg 
                       text-slate-400 hover:text-white hover:bg-slate-700 
                       transition-all disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 预览区域 */}
        <div className="px-6 py-6">
          {/* 路线数据展示 */}
          <div className="bg-slate-900/50 rounded-xl p-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-sm text-slate-400 mb-1">全程距离</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {distance.toFixed(2)} <span className="text-sm">km</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-400 mb-1">覆盖面积</p>
                <p className="text-2xl font-bold text-purple-400">
                  {area.toFixed(2)} <span className="text-sm">km²</span>
                </p>
              </div>
            </div>
          </div>

          {/* 路线名称输入 */}
          <div>
            <label 
              htmlFor="route-name" 
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              路线名称
            </label>
            <input 
              id="route-name" 
              type="text" 
              value={routeName} 
              onChange={(e) => setRouteName(e.target.value)} 
              placeholder="例如：清晨环校" 
              maxLength={50} 
              disabled={loading}
              className="w-full px-4 py-3 rounded-lg 
                         bg-slate-900 border border-slate-700 
                         text-white placeholder-slate-500 
                         focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent 
                         transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus 
              onClick={(e) => e.stopPropagation()} // 🔑 额外保险
            />
            <p className="text-xs text-slate-500 mt-2 text-right">
              {routeName.length}/50 字符
            </p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 bg-slate-900/50 flex gap-3">
          <button 
            onClick={onClose} 
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-lg 
                       bg-slate-700 text-white font-medium 
                       hover:bg-slate-600 active:scale-95 
                       transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            取消
          </button>
          <button 
            onClick={handleSave} 
            disabled={!routeName.trim() || loading} 
            className="flex-1 px-4 py-3 rounded-lg 
                       bg-gradient-to-r from-cyan-500 to-blue-500 
                       text-white font-medium 
                       hover:from-cyan-600 hover:to-blue-600 
                       disabled:from-slate-700 disabled:to-slate-700 
                       disabled:cursor-not-allowed disabled:opacity-50 
                       active:scale-95 
                       transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center"
          >
             {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                mode === 'save' ? '保存路线' : '保存更新'
              )}
          </button>
        </div>
      </div>
    </div>
  );
}
