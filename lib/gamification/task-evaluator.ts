
import { prisma } from "@/lib/prisma";
import { RunContext } from "./types";
import { TASK_CONDITION_REGISTRY } from "./task-conditions";
import { Prisma } from "@prisma/client";

/**
 * Evaluates progress for all active tasks for a user based on the completed run.
 * It uses the TASK_CONDITION_REGISTRY to determine progress for each task and performs
 * a safe, atomic upsert to update the progress in the database.
 * @param ctx The run context containing all data from the recent run.
 */
export async function evaluateTaskProgress(ctx: RunContext): Promise<void> {
  const activeTasks = await prisma.userTaskProgress.findMany({
    where: {
      userId: ctx.userId,
      status: "IN_PROGRESS",
    },
    include: {
      task: true, // Include the related Task model
    },
  });

  if (activeTasks.length === 0) {
    return;
  }

  const progressUpdates = activeTasks
    .map((progress) => {
      const evaluator = TASK_CONDITION_REGISTRY[progress.task.condition];
      if (!evaluator) {
        return null;
      }

      const delta = evaluator(ctx, progress.task);

      if (delta > 0) {
        return {
          progressId: progress.id,
          delta,
          currentVersion: progress.version,
        };
      }
      return null;
    })
    .filter((p): p is { progressId: string; delta: number; currentVersion: number } => p !== null);

  if (progressUpdates.length === 0) {
    return;
  }

  // Use Promise.all to execute all raw SQL updates concurrently with optimistic locking
  await Promise.all(
    progressUpdates.map(({ progressId, delta, currentVersion }) =>
      prisma.$executeRaw`
        UPDATE "user_task_progress"
        SET 
          "current_value" = LEAST("task"."target_value", "user_task_progress"."current_value" + ${delta}),
          "status" = CASE 
            WHEN LEAST("task"."target_value", "user_task_progress"."current_value" + ${delta}) >= "task"."target_value" 
            THEN 'COMPLETED' 
            ELSE 'IN_PROGRESS' 
          END,
          "version" = "user_task_progress"."version" + 1
        FROM "tasks" as "task"
        WHERE "user_task_progress"."id" = ${progressId}::uuid
          AND "user_task_progress"."task_id" = "task"."id"
          AND "user_task_progress"."version" = ${currentVersion};
      `
    )
  );
}
