"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { RunEventLog, RunEventStatus, RunEventType } from "@/types/run-sync";
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { isNativePlatform } from "@/lib/capacitor/safe-plugins";

const EVENT_INTERVAL_METERS = 600;
const TRIGGER_CHANCE = 0.22;
const CHASE_TARGET_PACE_SECONDS_PER_KM = 330;
const CHASE_WINDOW_SECONDS = 120;
const ENERGY_SURGE_TARGET_DISTANCE_METERS = 300;
const ENERGY_SURGE_WINDOW_SECONDS = 90;

export interface ActiveRandomEvent {
  eventId: string;
  eventType: RunEventType;
  triggeredAt: number;
  expiresAt: number;
  baselineDistance: number;
  baselineDuration: number;
  targetText: string;
  progressHint?: string;
}

interface UseRandomEventsParams {
  isRunning: boolean;
  isPaused: boolean;
  durationSeconds: number;
  distanceMeters: number;
  onEventResolved: (eventLog: RunEventLog) => void;
}

const randomEventType = (): RunEventType =>
  Math.random() > 0.5 ? "CHASE" : "ENERGY_SURGE";

const resolveWindowSeconds = (eventType: RunEventType): number =>
  eventType === "CHASE" ? CHASE_WINDOW_SECONDS : ENERGY_SURGE_WINDOW_SECONDS;

const buildTargetText = (eventType: RunEventType): string =>
  eventType === "CHASE"
    ? "请在2分钟内将配速提升至5分30秒每公里"
    : "请在90秒内完成300米冲刺";

const buildSuccessReward = (eventType: RunEventType): RunEventLog["reward"] =>
  eventType === "CHASE" ? { xp: 50 } : { xp: 30, stamina: 5 };

const speak = async (text: string) => {
  if (await isNativePlatform()) {
    try {
      await TextToSpeech.speak({
        text,
        lang: "zh-CN",
        category: "ambient",
      });
      return;
    } catch (e) {
      console.warn("Native TTS Error", e);
    }
  }

  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
};

export function useRandomEvents({
  isRunning,
  isPaused,
  durationSeconds,
  distanceMeters,
  onEventResolved,
}: UseRandomEventsParams) {
  const [activeEvent, setActiveEvent] = useState<ActiveRandomEvent | null>(null);
  const lastTriggerDistanceRef = useRef(0);

  useEffect(() => {
    if (!isRunning || isPaused || activeEvent) return;
    if (distanceMeters - lastTriggerDistanceRef.current < EVENT_INTERVAL_METERS) return;
    lastTriggerDistanceRef.current = distanceMeters;
    if (Math.random() > TRIGGER_CHANCE) return;
    const eventType = randomEventType();
    const nowDuration = durationSeconds;
    const targetText = buildTargetText(eventType);
    const event: ActiveRandomEvent = {
      eventId: uuidv4(),
      eventType,
      triggeredAt: Date.now(),
      expiresAt: nowDuration + resolveWindowSeconds(eventType),
      baselineDistance: distanceMeters,
      baselineDuration: nowDuration,
      targetText,
      progressHint: "事件已触发，快开始吧！"
    };
    setActiveEvent(event);
    void speak(targetText);
  }, [activeEvent, distanceMeters, durationSeconds, isPaused, isRunning]);

  useEffect(() => {
    if (!activeEvent || !isRunning || isPaused) return;

    const distanceDelta = Math.max(0, distanceMeters - activeEvent.baselineDistance);
    const durationDelta = Math.max(1, durationSeconds - activeEvent.baselineDuration);
    const paceSecondsPerKm = (durationDelta * 1000) / Math.max(1, distanceDelta);

    let isSuccess = false;
    let hint = "";

    if (activeEvent.eventType === "CHASE") {
      isSuccess = paceSecondsPerKm <= CHASE_TARGET_PACE_SECONDS_PER_KM && durationDelta >= 10;
      if (paceSecondsPerKm <= CHASE_TARGET_PACE_SECONDS_PER_KM) {
        hint = `配速达标，继续保持！(当前配速: ${Math.floor(paceSecondsPerKm/60)}'${Math.floor(paceSecondsPerKm%60)}")`;
      } else {
        hint = `进度落后，请加速！(当前配速: ${Math.floor(paceSecondsPerKm/60)}'${Math.floor(paceSecondsPerKm%60)}")`;
      }
    } else {
      isSuccess = distanceDelta >= ENERGY_SURGE_TARGET_DISTANCE_METERS;
      const remaining = Math.max(0, ENERGY_SURGE_TARGET_DISTANCE_METERS - distanceDelta);
      hint = `已冲刺 ${Math.floor(distanceDelta)} 米，还剩 ${Math.floor(remaining)} 米！`;
    }

    if (activeEvent.progressHint !== hint) {
      setActiveEvent(prev => prev ? { ...prev, progressHint: hint } : null);
    }

    if (durationSeconds < activeEvent.expiresAt && !isSuccess) return;

    let status: RunEventStatus = "FAILED";
    if (isSuccess) status = "SUCCESS";

    const reward = status === "SUCCESS" ? buildSuccessReward(activeEvent.eventType) : undefined;
    const penaltyMultiplier = status === "FAILED" ? 0.5 : undefined;
    onEventResolved({
      eventId: activeEvent.eventId,
      eventType: activeEvent.eventType,
      status,
      triggeredAt: activeEvent.triggeredAt,
      resolvedAt: Date.now(),
      reward,
      penaltyMultiplier,
    });
    void speak(status === "SUCCESS" ? "挑战成功，奖励已记录" : "挑战失败，本次收益将衰减");
    setActiveEvent(null);
  }, [activeEvent, distanceMeters, durationSeconds, isPaused, isRunning, onEventResolved]);

  useEffect(() => {
    return () => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
    };
  }, []);

  const countdownSeconds = useMemo(() => {
    if (!activeEvent) return 0;
    return Math.max(0, activeEvent.expiresAt - durationSeconds);
  }, [activeEvent, durationSeconds]);

  return { activeEvent, countdownSeconds, progressHint: activeEvent?.progressHint };
}
