"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Trophy, TrendingUp, ChevronRight } from "lucide-react";

export function PlanCenter() {
  // Mock data for V1
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  // JS getDay(): 0=Sun, 1=Mon. We want 0=Mon, 6=Sun.
  const jsDay = new Date().getDay();
  const todayIndex = jsDay === 0 ? 6 : jsDay - 1;

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-white overflow-y-auto">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Trophy className="text-yellow-500 w-6 h-6" /> 训练计划
        </h1>
        
        {/* Weekly Progress */}
        <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-5 mb-6 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-4">
             <div>
                <div className="text-sm text-slate-400">本周跑量</div>
                <div className="text-2xl font-bold font-mono">15.2 <span className="text-sm text-slate-500 font-sans">/ 30 km</span></div>
             </div>
             <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
                50%
             </div>
          </div>
          
          <div className="flex justify-between items-end h-24">
             {weekDays.map((day, idx) => {
               const isDone = idx < todayIndex; // Mock history
               const isToday = idx === todayIndex;
               const height = isDone ? '80%' : isToday ? '40%' : '10%';
               
               return (
                 <div key={idx} className="flex flex-col items-center gap-2 w-8">
                    <div className="w-2 bg-slate-700/50 rounded-full h-full relative overflow-hidden">
                        <div 
                            className={`absolute bottom-0 left-0 w-full rounded-full transition-all duration-500 ${
                                isDone ? 'bg-green-500' : isToday ? 'bg-purple-500' : 'bg-slate-600'
                            }`}
                            style={{ height }}
                        />
                    </div>
                    <div className={`text-xs font-bold ${isToday ? 'text-white' : 'text-slate-500'}`}>
                        {day}
                    </div>
                 </div>
               );
             })}
          </div>
        </div>
  
        {/* Today's Workout Card */}
        <div className="bg-gradient-to-br from-purple-900/80 to-indigo-900/80 border border-purple-500/30 rounded-2xl p-6 relative overflow-hidden mb-6 shadow-xl">
           <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/10 text-xs font-bold text-purple-200">
                      今日任务
                  </div>
                  <span className="text-xs text-purple-300">Day 14 / 60</span>
              </div>
              
              <h2 className="text-3xl font-bold mb-1">5K 轻松跑</h2>
              <p className="text-purple-200 text-sm mb-6">保持心率在 130-145 之间，轻松完成。</p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-black/20 rounded-lg p-3">
                      <div className="text-xs text-white/60 mb-1">目标距离</div>
                      <div className="text-xl font-mono font-bold">5.0 <span className="text-sm">km</span></div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3">
                      <div className="text-xs text-white/60 mb-1">建议配速</div>
                      <div className="text-xl font-mono font-bold">6:00 <span className="text-sm">/km</span></div>
                  </div>
              </div>
              
              <Button className="w-full bg-white text-purple-900 hover:bg-purple-50 font-bold h-12 text-lg shadow-lg">
                  开始训练
              </Button>
           </div>
           
           {/* Background Decor */}
           <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
           <Trophy className="absolute -right-6 -bottom-6 w-40 h-40 text-white/5 rotate-12" />
        </div>

        {/* Next Workouts */}
        <h3 className="text-lg font-bold mb-4 text-slate-200">后续计划</h3>
        <div className="space-y-3">
            {[1, 2, 3].map((i) => (
                <div key={i} className="bg-slate-800/30 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center text-slate-400 font-bold">
                            {new Date().getDate() + i}
                        </div>
                        <div>
                            <div className="font-bold text-slate-200">间歇跑 400m x 8</div>
                            <div className="text-xs text-slate-500">预计 45 分钟 • 强度高</div>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}
