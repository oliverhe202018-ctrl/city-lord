'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface LeaveClubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LeaveClubModal({ isOpen, onClose, onConfirm }: LeaveClubModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-br from-[#ff6b6b] to-[#ff8e53] text-white shadow-2xl"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full bg-black/10 p-2 transition-colors hover:bg-black/20"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center px-6 py-12 text-center">
              <h2 className="mb-4 text-3xl font-black leading-tight tracking-tight">
                你确定要
                <br />
                退出该俱乐部吗？
              </h2>
              
              <p className="mb-8 text-white/90">
                退出后你可以随时重新加入。
              </p>

              <button
                onClick={onConfirm}
                className="mb-3 w-full rounded-xl bg-[#1a1a1a] py-4 text-lg font-bold text-white transition-transform active:scale-95"
              >
                确认退出
              </button>
              
              <button
                onClick={onClose}
                className="w-full py-2 text-sm font-medium text-white/80 hover:text-white"
              >
                取消
              </button>
            </div>

            {/* Decorative Background Pattern */}
            <div className="pointer-events-none absolute inset-0 opacity-10">
              <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
              </svg>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
