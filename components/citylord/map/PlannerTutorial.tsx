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
        element.classList.add("relative", "z-[60]");
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
            element.classList.remove("relative", "z-[60]");
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
