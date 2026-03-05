'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquarePlus, Loader2, Copy, CheckCircle2 } from 'lucide-react';

interface FeedbackDialogProps {
    open: boolean;
    onClose: () => void;
}

export function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
    const [text, setText] = useState('');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [copied, setCopied] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = useCallback(async () => {
        const content = text.trim();
        if (!content) return;
        setStatus('submitting');

        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content,
                    deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : '',
                    timestamp: new Date().toISOString(),
                }),
            });
            if (!res.ok) throw new Error('Submit failed');
            setStatus('success');
            setText('');
            setTimeout(() => {
                onClose();
                setStatus('idle');
            }, 1500);
        } catch {
            setStatus('error');
            // Fallback: copy to clipboard
            try {
                await navigator.clipboard.writeText(`[CityLord 反馈]\n${content}\n\n设备: ${navigator.userAgent}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch {
                // clipboard also failed, silently ignore
            }
        }
    }, [text, onClose]);

    const handleClose = useCallback(() => {
        onClose();
        setStatus('idle');
        setText('');
    }, [onClose]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="fixed bottom-0 left-0 right-0 z-[101] mx-auto max-w-lg rounded-t-2xl border border-white/10 bg-card p-5 shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground/90">
                                <MessageSquarePlus className="h-4 w-4 text-primary" />
                                问题反馈 · 体验建议
                            </h3>
                            <button
                                onClick={handleClose}
                                className="rounded-full p-1.5 text-foreground/40 hover:text-foreground/70 hover:bg-white/10 transition-all"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Textarea */}
                        <textarea
                            ref={textareaRef}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="告诉我们你遇到了什么问题，或者有什么建议…"
                            rows={4}
                            maxLength={500}
                            disabled={status === 'submitting' || status === 'success'}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/25 resize-none outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                        />

                        {/* Char count */}
                        <p className="mt-1 text-right text-[10px] text-foreground/25">
                            {text.length}/500
                        </p>

                        {/* Status messages */}
                        {status === 'error' && (
                            <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                                {copied ? (
                                    <>
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                        <span>提交暂不可用，反馈内容已复制到剪贴板</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-3.5 w-3.5" />
                                        <span>提交失败，正在尝试复制到剪贴板…</span>
                                    </>
                                )}
                            </div>
                        )}

                        {status === 'success' && (
                            <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>感谢您的反馈！我们会尽快处理</span>
                            </div>
                        )}

                        {/* Submit button */}
                        <button
                            onClick={handleSubmit}
                            disabled={!text.trim() || status === 'submitting' || status === 'success'}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {status === 'submitting' ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    提交中…
                                </>
                            ) : status === 'success' ? (
                                <>
                                    <CheckCircle2 className="h-4 w-4" />
                                    已提交
                                </>
                            ) : (
                                '提交反馈'
                            )}
                        </button>

                        {/* Safe area spacer for iOS */}
                        <div className="h-[env(safe-area-inset-bottom)]" />
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
