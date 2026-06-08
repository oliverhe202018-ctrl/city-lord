
const fs = require("fs");
const file = "src/hooks/useRunningTracker.ts";
let content = fs.readFileSync(file, "utf8");

const startStr = "const saveRun = useCallback(async (isFinal: boolean = false) => {";
const endStr = "  }, [userId, clearRecovery, clubId]); // Only depends on userId/clubId & clearRecovery — refs handle the rest";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr, startIndex);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find bounds");
  process.exit(1);
}

const replacement = `const saveRun = useCallback(async (isFinal: boolean = false) => {
    if (!userId) {
      console.warn("[saveRun] No userId, skipping save");
      return { settlingAsync: false, isDuplicate: false, runId: undefined };
    }

    // ─── Read LIVE values from refs ───
    let liveDistance = distanceRef.current;
    let liveDuration = durationRef.current;
    let livePath = fullPathRef.current;
    let liveClaims = sessionClaimsRef.current;

    // ─── Payload 空数据容忍性恢复 ───
    if (livePath.length === 0 && liveDistance <= 0 && liveDuration <= 0) {
      console.warn("[useRunningTracker] Payload empty — attempting recovery fallback");
      try {
        const res = await Preferences.get({ key: RECOVERY_KEY });
        if (res.value) {
          const data = JSON.parse(res.value);
          liveDistance = data.distance || 0;
          liveDuration = data.duration || 0;
          const rawPath = Array.isArray(data.fullPath || data.path) ? (data.fullPath || data.path) : [];
          livePath = rawPath.filter(
            (p: any) => p && typeof p.lat === "number" && typeof p.lng === "number"
              && Number.isFinite(p.lat) && Number.isFinite(p.lng)
          );
          liveClaims = Array.isArray(data.closedPolygons) ? data.closedPolygons : [];
        }
      } catch (recoveryErr) {
        console.error("[useRunningTracker] Recovery fallback parse failed", recoveryErr);
      }

      if (livePath.length === 0 && liveDistance <= 0 && liveDuration <= 0) {
        console.warn("[saveRun] Data empty after recovery — returning silent fallback");
        return { settlingAsync: false, isDuplicate: false, runId: undefined };
      }
    }

    /** 统一的本地兜底入队函数，所有失败路径都通过此函数处理，绝不 throw */
    const _enqueueSilently = async (reason: string): Promise<{ settlingAsync: false; isDuplicate: false; runId: undefined }> => {
      console.warn(\`[saveRun] Falling back to local queue. Reason: \${reason}\`);
      const stepsVal = currentStepsRef.current > 0
        ? currentStepsRef.current
        : estimateStepsFromDistanceMeters(liveDistance);
      const payload = {
        userId,
        clubId: clubId ?? null,
        idempotencyKey: runIdempotencyKeyRef.current,
        distance: liveDistance,
        duration: liveDuration,
        path: livePath,
        polygons: liveClaims,
        timestamp: Date.now(),
        totalSteps: stepsVal,
        steps: stepsVal,
        manualLocationCount: 0,
        eventsHistory: eventsHistoryRef.current,
        clientFlags: clientFlagsRef.current,
      };
      try {
        const enqueued = await settlementRetryQueue.enqueueSettlement(payload);
        if (enqueued === false) {
          console.log("[saveRun] idempotencyKey already in queue — treating as success (idempotent)");
        } else {
          console.log("[saveRun] Payload enqueued to SettlementRetryQueue successfully");
          if (isFinal) {
            toast.info("网络不佳，跑步数据已安全保存，将在网络恢复后自动上传", { duration: 5000 });
          }
        }
      } catch (queueErr) {
        console.error("[saveRun] IndexedDB enqueue failed, falling back to localStorage:", queueErr);
        try {
          const stored = JSON.parse(localStorage.getItem("PENDING_RUN_UPLOAD") || "[]");
          const idx = stored.findIndex((p: any) => p.idempotencyKey === payload.idempotencyKey);
          if (idx >= 0) stored[idx] = payload; else stored.push(payload);
          localStorage.setItem("PENDING_RUN_UPLOAD", JSON.stringify(stored));
          console.log("[saveRun] Payload saved to localStorage PENDING_RUN_UPLOAD as last resort");
        } catch (lsErr) {
          console.error("[saveRun] localStorage fallback also failed:", lsErr);
        }
      }
      if (isFinal) {
        clearRecovery();
        setSessionClaims([]);
        sessionClaimsRef.current = [];
        setEventsHistory([]);
        setClientFlags([]);
        clientFlagsRef.current = [];
      }
      return { settlingAsync: false, isDuplicate: false, runId: undefined };
    };

    const maxRetries = 3;
    const retryDelays = [1000, 2000, 4000];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let controller: AbortController | undefined;
      let timeoutId: NodeJS.Timeout | undefined;
      try {
        setIsSaving(true);

        const SIMPLIFY_THRESHOLD = 2000;
        const SIMPLIFY_TOLERANCE = 0.00005;
        let simplifiedPath: Location[] = livePath;
        if (livePath.length > SIMPLIFY_THRESHOLD) {
          simplifiedPath = simplifyPath(livePath, SIMPLIFY_TOLERANCE) as Location[];
          console.log(
            \`[Simplify] ??? Path reduced: \${livePath.length} → \${simplifiedPath.length} points \` +
            \`(\${((1 - simplifiedPath.length / livePath.length) * 100).toFixed(1)}% reduction)\`
          );
        }

        const stepsForSubmit = currentStepsRef.current > 0
          ? currentStepsRef.current
          : estimateStepsFromDistanceMeters(liveDistance);

        const PAYLOAD_SIZE_WARNING = 3_800_000;
        const MAX_POINTS_AFTER_TRUNCATION = 200;
        const MAX_EVENTS_AFTER_TRUNCATION = 50;

        let finalPath: Location[] = simplifiedPath;
        let finalEvents = eventsHistoryRef.current;

        const runData = {
          clubId: clubId ?? null,
          idempotencyKey: runIdempotencyKeyRef.current,
          distance: liveDistance,
          duration: liveDuration,
          path: simplifiedPath,
          polygons: liveClaims,
          timestamp: Date.now(),
          totalSteps: stepsForSubmit,
          steps: stepsForSubmit,
          manualLocationCount: 0,
          eventsHistory: eventsHistoryRef.current,
          clientFlags: clientFlagsRef.current,
        };
        const payloadSize = JSON.stringify(runData).length;

        if (payloadSize > PAYLOAD_SIZE_WARNING) {
          console.warn(\`[PayloadPreCheck] Payload size \${payloadSize} bytes exceeds 3.8MB threshold, forcing secondary truncation\`);
          if (simplifiedPath.length > MAX_POINTS_AFTER_TRUNCATION) {
            const step = Math.ceil(simplifiedPath.length / MAX_POINTS_AFTER_TRUNCATION);
            finalPath = simplifiedPath.filter((_, idx) => idx % step === 0 || idx === simplifiedPath.length - 1);
          }
          if (eventsHistoryRef.current.length > MAX_EVENTS_AFTER_TRUNCATION) {
            finalEvents = eventsHistoryRef.current.slice(-MAX_EVENTS_AFTER_TRUNCATION);
          }
          toast.warning("跑步数据过大，已自动压缩轨迹以保证上传成功");
        }

        controller = new AbortController();
        timeoutId = setTimeout(() => {
          controller!.abort();
          _enqueueSilently("AbortTimeout 120s").catch(() => {});
          console.warn("[AbortTimeout] 120s timeout triggered");
        }, 120_000);

        const result = await saveRunActivity(userId, {
          clubId: clubId ?? null,
          idempotencyKey: runIdempotencyKeyRef.current,
          distance: liveDistance,
          duration: liveDuration,
          path: finalPath,
          polygons: liveClaims,
          timestamp: Date.now(),
          totalSteps: stepsForSubmit,
          steps: stepsForSubmit,
          manualLocationCount: 0,
          eventsHistory: finalEvents,
          clientFlags: clientFlagsRef.current,
        } as any);

        clearTimeout(timeoutId);
        timeoutId = undefined;

        if (result.success) {
          if (isFinal) {
            clearRecovery();
            setEventsHistory([]);
            setClientFlags([]);
            clientFlagsRef.current = [];
            mutate("/api/home/summary");
            mutate("/api/mission/fetch-user-missions");

            if (!result.data?.settlingAsync) {
              mutate(
                (key) => typeof key === "string" && key.startsWith("/api/city/fetch-territories?cityId="),
                undefined, { revalidate: true }
              ).then(() => {
                setSessionClaims([]);
                sessionClaimsRef.current = [];
              });
              window.dispatchEvent(new CustomEvent("citylord:refresh-territories"));
            }
          }

          if (result.data?.runId) { setSavedRunId(result.data.runId); savedRunIdRef.current = result.data.runId; }
          if (result.data?.runNumber) setRunNumber(result.data.runNumber);
          if (result.data?.damageSummary) setDamageSummary(result.data.damageSummary);
          if (result.data?.maintenanceSummary) setMaintenanceSummary(result.data.maintenanceSummary);
          if (result.data?.settledTerritoriesCount !== undefined) setSettledTerritoriesCount(result.data.settledTerritoriesCount);
          if (result.data?.isValid !== undefined) setRunIsValid(result.data.isValid);
          if (result.data?.antiCheatLog !== undefined) setAntiCheatLog(result.data.antiCheatLog ?? null);
          if (result.data?.totalSteps !== undefined) setCurrentSteps(Math.max(0, Number(result.data.totalSteps)));

          if (result.data?.settlingAsync) {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = setInterval(async () => {
              try {
                if (!savedRunIdRef.current) return;
                const pollResult = await fetchShim(\`/api/runs/\${savedRunIdRef.current}/status\`);
                if (pollResult.ok) {
                  const data = await pollResult.json();
                  if (data.status === "COMPLETED") {
                    clearInterval(pollingIntervalRef.current!);
                    pollingIntervalRef.current = null;
                    if (data.settledTerritoriesCount !== undefined) {
                      setSettledTerritoriesCount(data.settledTerritoriesCount);
                    }
                    if (data.territories) {
                      setRunTerritories(data.territories);
                    }
                    mutate(
                      (key) => typeof key === "string" && key.startsWith("/api/city/fetch-territories?cityId="),
                      undefined, { revalidate: true }
                    ).then(() => {
                      setSessionClaims([]);
                      sessionClaimsRef.current = [];
                    });
                    window.dispatchEvent(new CustomEvent("citylord:refresh-territories"));
                    toast.success("领地结算已完成！", { duration: 4000 });
                  } else if (data.status === "FAILED") {
                    clearInterval(pollingIntervalRef.current!);
                    pollingIntervalRef.current = null;
                    toast.error("领地结算失败");
                  }
                }
              } catch (pollErr) {
                console.warn("[useRunningTracker] Settlement poll failed", pollErr);
              }
            }, 2000);
          }
          
          return {
            settlingAsync: result.data?.settlingAsync,
            isDuplicate: result.data?.isDuplicate,
            runId: result.data?.runId,
            runNumber: result.data?.runNumber,
            damageSummary: result.data?.damageSummary,
            maintenanceSummary: result.data?.maintenanceSummary,
            settledTerritoriesCount: result.data?.settledTerritoriesCount,
            territories: result.data?.territories,
          };
        } else {
          console.error("[saveRun] Server returned error:", result.error);
          return await _enqueueSilently(\`server_error: \${result.error}\`);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        console.error(\`[saveRun] attempt \${attempt + 1}/\${maxRetries} error:\`, err?.message || err);

        if (err?.isAuthError === true || err?.message === "UNAUTHORIZED") {
          console.warn("[saveRun] Auth error detected — silently enqueuing and exiting");
          return await _enqueueSilently("auth_error_401");
        }

        if (attempt >= maxRetries - 1) {
          return await _enqueueSilently(\`max_retries_exceeded: \${err?.message}\`);
        }

        const delay = retryDelays[attempt];
        await new Promise(resolve => setTimeout(resolve, delay));
      } finally {
        setIsSaving(false);
      }
    }

    return await _enqueueSilently("loop_exhausted");
  }, [userId, clearRecovery, clubId]);`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex + endStr.length);
fs.writeFileSync(file, content);
console.log("Patched successfully");

