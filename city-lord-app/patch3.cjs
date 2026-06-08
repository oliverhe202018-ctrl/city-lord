
const fs = require("fs");
const file = "src/components/citylord/running/immersive-mode.tsx";
let content = fs.readFileSync(file, "utf8");
const lines = content.split("\n");
const startLine = 808;
const endLine = 936;

const replacement = `  const executeFinalSave = async (finalSnapshotHexes: number) => {
    if (!saveRun || isSubmitting || hasSavedRunRef.current) return;
    
    freezeTrackerForSummary();
    setIsSubmitting(true);
    
    try {
      const audio = new Audio("/sounds/run_finish.mp3");
      (window as typeof window & { finishAudio?: HTMLAudioElement }).finishAudio = audio;
      audio.play().catch(() => { });
    } catch { }

    const initialSnapshot = buildSummarySnapshot(finalSnapshotHexes, undefined);
    setSummarySnapshot(initialSnapshot);
    setShowSummary(true);
    setIsSettlementLoading(true);

    let res: Awaited<ReturnType<typeof saveRun>>;
    try {
      res = await saveRun(true);
    } catch (unexpectedError) {
      console.error("[executeFinalSave] Unexpected throw from saveRun (should not happen):", unexpectedError);
      setIsSettlementLoading(false);
      hasSavedRunRef.current = true;
      await performCleanExit();
      setShowSummary(false);
      onStop();
      return;
    }

    if (res?.isDuplicate) {
      toast.info("本次跑动已通过离线守护保存，请等待网络恢复后自动同步", { duration: 5000 });
      hasSavedRunRef.current = true;
      await performCleanExit();
      setShowSummary(false);
      onStop();
      return;
    }

    hasSavedRunRef.current = true;
    await performCleanExit();

    const resolvedRunId = res?.runId || savedRunId || undefined;
    if (resolvedRunId) {
      setEffectiveRunId(resolvedRunId);
    }

    setSummarySnapshot(prev => {
      if (!prev) return null;
      return {
        ...prev,
        runId: resolvedRunId,
        runNumber: res?.runNumber || prev.runNumber,
        damageSummary: res?.damageSummary || prev.damageSummary,
        maintenanceSummary: res?.maintenanceSummary || prev.maintenanceSummary,
        hexesCaptured: res?.settledTerritoriesCount !== undefined ? res.settledTerritoriesCount : prev.hexesCaptured,
      };
    });

    if (res?.settlingAsync) {
      toast.success("跑步记录已保存，领地正在后台极速结算中...", { duration: 5000 });
      setIsPollingSettlement(true);
    } else {
      setIsSettlementLoading(false);
    }

    if (res?.territories && res.territories.length > 0) {
      import("@/store/useGameStore").then(({ useGameStore }) => {
        const firstTerrId = res.territories[0].id;
        useGameStore.getState().setSelectedTerritoryId(firstTerrId);
        console.log(\`[ImmersiveMode] Triggered ID swap: \${firstTerrId}\`);
      });
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("citylord:refresh-territories"));
    }
    setIsSubmitting(false);
  };`;

lines.splice(startLine - 1, endLine - startLine + 1, replacement);
fs.writeFileSync(file, lines.join("\n"));
console.log("Patched successfully");

