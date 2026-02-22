import React from 'react';

export function ImmersiveSkeleton() {
    return (
        <div className="fixed inset-0 z-[9999] flex h-[100dvh] w-full flex-col bg-slate-900 border border-white/5 animate-pulse">
            {/* Header Area */}
            <div className="relative z-10 w-full bg-gradient-to-b from-black/80 to-transparent p-6 pt-12">
                <div className="flex h-12 w-full items-center justify-between rounded-full bg-black/40 px-4 py-2 backdrop-blur-md border border-white/5">
                    <div className="h-6 w-24 bg-white/10 rounded-full" />
                    <div className="h-6 w-20 bg-white/10 rounded-full" />
                    <div className="h-8 w-8 bg-white/10 rounded-full" />
                </div>
            </div>

            {/* HUD Area (Main Content) */}
            <div className="pointer-events-none relative z-10 mt-auto flex w-full flex-col items-center pb-32">
                {/* Main distance */}
                <div className="flex flex-col items-center">
                    <div className="h-24 w-48 bg-white/10 rounded-2xl mb-2" />
                    <div className="h-6 w-24 bg-white/10 rounded-full" />
                </div>

                {/* 3 Secondary Stats */}
                <div className="mt-8 grid w-full max-w-sm grid-cols-3 gap-4 px-6 opacity-80">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                            <div className="h-8 w-16 bg-white/10 rounded-md" />
                            <div className="h-4 w-12 bg-white/10 rounded-sm" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Buttons Area */}
            <div className="absolute bottom-10 left-0 right-0 z-20 flex justify-center w-full px-8 pb-safe">
                <div className="h-20 w-20 bg-[#22c55e]/50 rounded-full border-4 border-white/10" />
            </div>
        </div>
    );
}
