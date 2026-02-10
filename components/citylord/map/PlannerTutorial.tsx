"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, ChevronRight } from "lucide-react";

interface Step {
  targetId: string;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    targetId: "planner-hud",
    title: "实时数据",
    description: "顶部实时显示规划路线的全程距离和预计占领面积。"
  },
  {
    targetId: "planner-map-center",
    title: "点击打点",
    description: "在地图上任意点击即可添加路径点，系统会自动按顺序连接它们。"
  },
  {
    targetId: "planner-draw-btn",
    title: "手绘模式",
    description: "点击切换到画笔模式，可以在地图上自由滑动手指进行轨迹绘制。"
  },
  {
    targetId: "planner-snap-toggle",
    title: "路网吸附",
    description: "开启后，路径会自动吸附并沿着真实道路生成，不再是直线。"
  },
  {
    targetId: "planner-map-center",
    title: "闭环占领",
    description: "当终点回到起点附近（200米内）时，路径会自动闭合并显示绿色填充。"
  },
  {
    targetId: "planner-tools",
    title: "编辑路径",
    description: "使用撤销、重做或清空功能来微调你的路线规划。"
  }
];

function TutorialAnimation({ stepIndex }: { stepIndex: number }) {
    if (stepIndex === 1) { // Step 2: Waypoints
        return (
            <div className="relative w-64 h-64 bg-black/40 backdrop-blur rounded-xl border border-white/10 shadow-2xl overflow-hidden">
                <svg viewBox="0 0 200 200" className="w-full h-full">
                    {/* Points */}
                    <motion.circle cx="50" cy="150" r="6" fill="#3b82f6" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }} />
                    <motion.circle cx="100" cy="50" r="6" fill="#3b82f6" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2 }} />
                    <motion.circle cx="150" cy="150" r="6" fill="#3b82f6" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 2.2 }} />
                    
                    {/* Lines */}
                    <motion.path 
                        d="M 50 150 L 100 50" 
                        stroke="#3b82f6" strokeWidth="4" strokeLinecap="round"
                        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5, duration: 0.5 }}
                    />
                    <motion.path 
                        d="M 100 50 L 150 150" 
                        stroke="#3b82f6" strokeWidth="4" strokeLinecap="round"
                        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.5, duration: 0.5 }}
                    />
                    
                    {/* Final Area Fill (Optional for this step, user said 'green semi-transparent background') */}
                    <motion.path 
                        d="M 50 150 L 100 50 L 150 150 Z" 
                        fill="#22c55e" fillOpacity="0.2"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }}
                    />
                </svg>
                <div className="absolute bottom-2 w-full text-center text-xs text-white/60">点击地图添加点位</div>
            </div>
        )
    }
    
    if (stepIndex === 4) { // Step 5: Loop Closure
        return (
            <div className="relative w-64 h-64 bg-black/40 backdrop-blur rounded-xl border border-white/10 shadow-2xl overflow-hidden">
                 <svg viewBox="0 0 200 200" className="w-full h-full">
                    {/* Open Pentagon Points */}
                    <circle cx="100" cy="40" r="4" fill="#3b82f6" />
                    <circle cx="160" cy="80" r="4" fill="#3b82f6" />
                    <circle cx="140" cy="160" r="4" fill="#3b82f6" />
                    <circle cx="60" cy="160" r="4" fill="#3b82f6" />
                    <circle cx="40" cy="80" r="4" fill="#3b82f6" />
                    
                    {/* Existing Lines */}
                    <path d="M 100 40 L 160 80 L 140 160 L 60 160 L 40 80" stroke="#3b82f6" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    
                    {/* Dashed Closing Line */}
                    <motion.path 
                        d="M 40 80 L 100 40" 
                        stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8"
                        initial={{ pathLength: 0, opacity: 0 }} 
                        animate={{ pathLength: 1, opacity: 1 }} 
                        transition={{ delay: 0.5, duration: 1 }}
                    />
                    
                    {/* Success Fill */}
                    <motion.path 
                        d="M 100 40 L 160 80 L 140 160 L 60 160 L 40 80 Z" 
                        fill="#22c55e" 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 0.3 }} 
                        transition={{ delay: 1.5, duration: 0.5 }}
                    />
                    
                    {/* Success Checkmark */}
                    <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 1.8, type: "spring" }}>
                        <circle cx="100" cy="100" r="20" fill="#22c55e" />
                        <path d="M 90 100 L 96 106 L 110 92" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
                    </motion.g>
                </svg>
                <div className="absolute bottom-2 w-full text-center text-xs text-white/60">回到起点自动闭合</div>
            </div>
        )
    }
    
    return null;
}

interface PlannerTutorialProps {
  forceShow?: boolean;
  onClose: () => void;
}

export function PlannerTutorial({ forceShow, onClose }: PlannerTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Check storage on mount
  useEffect(() => {
    const hasSeen = localStorage.getItem("hasSeenPlannerTutorial");
    if (forceShow) {
      setCurrentStep(0);
      setIsVisible(true);
    } else if (!hasSeen) {
      setIsVisible(true);
    }
  }, [forceShow]);

  // Update target rect when step changes
  useEffect(() => {
    if (!isVisible) return;

    // Small delay to ensure UI is rendered
    const timer = setTimeout(() => {
      const step = STEPS[currentStep];
      const element = document.getElementById(step.targetId);
      
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        // Add spotlight effect
        const style = window.getComputedStyle(element);
        const isPositioned = style.position !== 'static';
        
        element.classList.add("z-[110]"); // Ensure it's above mask
        if (!isPositioned) {
             element.classList.add("relative");
             element.setAttribute("data-tutorial-relative", "true");
        }
      } else if (step.targetId === "planner-map-center") {
        // Fallback for map center
        if (typeof window !== 'undefined') {
            const width = window.innerWidth;
            const height = window.innerHeight;
            setTargetRect({
              left: width * 0.2,
              top: height * 0.3,
              width: width * 0.6,
              height: height * 0.4,
              right: width * 0.8,
              bottom: height * 0.7,
              x: width * 0.2,
              y: height * 0.3,
              toJSON: () => {}
            });
        }
      }
    }, 100);

    return () => {
        clearTimeout(timer);
        // Cleanup spotlight effect
        const step = STEPS[currentStep];
        const element = document.getElementById(step.targetId);
        if (element) {
            element.classList.remove("z-[110]");
            if (element.getAttribute("data-tutorial-relative") === "true") {
                element.classList.remove("relative");
                element.removeAttribute("data-tutorial-relative");
            }
        }
    };
  }, [currentStep, isVisible]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    localStorage.setItem("hasSeenPlannerTutorial", "true");
    setIsVisible(false);
    onClose();
  };

  if (!isVisible) return null;

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  // Determine Dialog Position (Top or Bottom)
  const isTargetBottom = targetRect && typeof window !== 'undefined' ? targetRect.top > window.innerHeight / 2 : false;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden pointer-events-none">
      {/* Background Mask with Hole (SVG) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="mask-hole">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <motion.rect
                initial={false}
                animate={{
                  x: targetRect.left - 10,
                  y: targetRect.top - 10,
                  width: targetRect.width + 20,
                  height: targetRect.height + 20,
                  rx: 16 // Rounded corners
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect 
          width="100%" 
          height="100%" 
          fill="rgba(0,0,0,0.7)" 
          mask="url(#mask-hole)" 
        />
      </svg>
      
      {/* Animations Overlay */}
      <div className="absolute inset-0 z-[105] pointer-events-none flex items-center justify-center">
         <TutorialAnimation stepIndex={currentStep} />
      </div>

      {/* Tutorial Dialog */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className={`absolute left-4 right-4 mx-auto max-w-sm bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl pointer-events-auto ${
            isTargetBottom ? "top-24" : "bottom-24"
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold text-white">{step.title}</h3>
            {/* Step Indicator */}
            <div className="flex gap-1 mt-1.5">
              {STEPS.map((_, i) => (
                <div 
                  key={i} 
                  className={`w-1.5 h-1.5 rounded-full ${i === currentStep ? "bg-white" : "bg-white/20"}`} 
                />
              ))}
            </div>
          </div>
          
          <p className="text-white/70 text-sm leading-relaxed mb-6">
            {step.description}
          </p>

          <div className="flex justify-between items-center">
            <button 
              onClick={handleFinish}
              className="text-white/40 text-sm hover:text-white transition-colors"
            >
              跳过
            </button>
            <Button 
              onClick={handleNext}
              className={`rounded-full font-bold px-6 ${
                isLastStep ? "bg-[#22c55e] hover:bg-[#16a34a] text-black" : "bg-[#f87171] hover:bg-[#ef4444] text-white"
              }`}
            >
              {isLastStep ? "我知道了" : "下一步"}
              {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
