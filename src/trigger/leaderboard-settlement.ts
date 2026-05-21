import { task } from "@trigger.dev/sdk/v3";
import { distributeLeaderboardRewards } from "@/lib/game-logic/leaderboard-rewards";

// ─── Cron: 每日午夜结算排行榜奖励 ───
export const leaderboardSettlementTask = task({
  id: "leaderboard-settlement",
  // Retry config
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30_000,
    randomize: false,
  },
  run: async (payload: { force?: boolean }) => {
    console.log("[LeaderboardSettlement] Starting daily reward distribution...");

    const settlementDate = new Date();
    // Use yesterday's date for settlement (since we run at midnight)
    settlementDate.setDate(settlementDate.getDate() - 1);
    settlementDate.setHours(0, 0, 0, 0);

    const result = await distributeLeaderboardRewards(settlementDate);

    if (result.success) {
      console.log(
        `[LeaderboardSettlement] ✅ Completed: ${result.totalRewarded} coins distributed to ${result.details.length} users`,
      );
      return {
        success: true,
        totalRewarded: result.totalRewarded,
        usersRewarded: result.details.length,
        settlementDate: settlementDate.toISOString(),
      };
    } else {
      console.warn(
        `[LeaderboardSettlement] ⚠️ Skipped or failed: ${result.error}`,
      );
      return {
        success: false,
        error: result.error,
        settlementDate: settlementDate.toISOString(),
      };
    }
  },
});
