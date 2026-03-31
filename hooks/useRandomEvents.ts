"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { RunEventLog, RunEventStatus, RunEventType } from "@/types/run-sync";

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

const speak = (text: string) => {
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
    const event: ActiveRandomEvent = {
      eventId: uuidv4(),
      eventType,
      triggeredAt: Date.now(),
      expiresAt: nowDuration + resolveWindowSeconds(eventType),
      baselineDistance: distanceMeters,
      baselineDuration: nowDuration,
      targetText: buildTargetText(eventType),
    };
    setActiveEvent(event);
    speak(event.targetText);
  }, [activeEvent, distanceMeters, durationSeconds, isPaused, isRunning]);

  useEffect(() => {
    if (!activeEvent || !isRunning || isPaused) return;
    if (durationSeconds < activeEvent.expiresAt) return;

    const distanceDelta = Math.max(0, distanceMeters - activeEvent.baselineDistance);
    const durationDelta = Math.max(1, durationSeconds - activeEvent.baselineDuration);
    const paceSecondsPerKm = (durationDelta * 1000) / Math.max(1, distanceDelta);

    let status: RunEventStatus = "FAILED";
    if (activeEvent.eventType === "CHASE") {
      if (paceSecondsPerKm <= CHASE_TARGET_PACE_SECONDS_PER_KM) status = "SUCCESS";
    } else if (distanceDelta >= ENERGY_SURGE_TARGET_DISTANCE_METERS) {
      status = "SUCCESS";
    }

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
    speak(status === "SUCCESS" ? "挑战成功，奖励已记录" : "挑战失败，本次收益将衰减");
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

  return { activeEvent, countdownSeconds };
}
