
import { Task } from "@prisma/client";
import { RunContext } from "./types";

/**
 * A registry of pure functions that evaluate the progress delta for a given task condition.
 * Each function takes the run context and the task definition, and returns a number representing the progress made.
 */

// Define the shape of an evaluator function
type TaskEvaluator = (ctx: RunContext, task: Task) => number;

export const TASK_CONDITION_REGISTRY: Record<string, TaskEvaluator> = {
  /**
   * Condition: Counts the number of random events triggered during the run.
   */
  TRIGGER_RANDOM_EVENTS: (ctx) => {
    return ctx.triggeredEventIds.length;
  },

  /**
   * Condition: Checks if the area gained in a single run meets or exceeds the task's target value.
   * Returns 1 if the condition is met (representing one completion of the task), otherwise 0.
   */
  CLAIM_AREA_SINGLE_RUN: (ctx, task) => {
    return ctx.totalAreaGained >= task.targetValue ? 1 : 0;
  },

  // ... other task conditions can be added here
};
