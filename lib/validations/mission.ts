import { z } from 'zod';

// ===== 枚举值定义 =====
export const MissionTypeEnum = z.enum([
  'daily',
  'weekly',
  'achievement',
  'one_time',
  'special',
  // Database actual values:
  'RUN_COUNT',
  'DISTANCE',
  'HEX_COUNT',
  'UNIQUE_HEX',
  'NIGHT_RUN',
  'ACTIVE_DAYS',
  'HEX_TOTAL',
  'CALORIES'
]);

export const MissionFrequencyEnum = z.enum([
  'daily',
  'weekly',
  'one_time',
  'achievement' // Database actual value
]);

export const MissionCategoryEnum = z.enum([
  'running',
  'training',
  'social',
  'exploration',
  'special',
]);

export const MissionTargetTypeEnum = z.enum([
  'distance',
  'duration',
  'count',
  'pace',
  'calories',
  'streak',
]);

// ===== 核心 Schema =====
export const MissionTemplateSchema = z.object({
  id:                z.string().uuid().or(z.string()),
  title:             z.string().min(1, '任务标题不能为空'),
  description:       z.string().nullable().optional(),
  type:              MissionTypeEnum.or(z.string()), // Optional fallback to allow other DB types
  category:          MissionCategoryEnum.nullable().optional(), // Not present in DB
  frequency:         MissionFrequencyEnum.nullable().optional(),
  target_type:       MissionTargetTypeEnum.nullable().optional(), // Not present in DB
  target_value:      z.number().positive('目标值必须为正数').nullable().optional(), // In DB
  target:            z.number().positive().nullable().optional(), // In DB
  reward_coins:      z.number().int().nonnegative().default(0),
  reward_experience: z.number().int().nonnegative().default(0),
  reward_items:      z.any().nullable().optional(), // Not present in DB
  is_active:         z.boolean().default(true).optional(), // Not present in DB
  sort_order:        z.number().int().nonnegative().default(0).optional(), // Not present in DB
  created_at:        z.date().or(z.string().datetime()).nullable().optional(),
  updated_at:        z.date().or(z.string().datetime()).nullable().optional(),
}).passthrough();

// ===== 导出类型 =====
export type MissionTemplateValidated = z.infer<typeof MissionTemplateSchema>;

// ===== 批量校验工具函数 =====
export function validateMissionTemplates(
  templates: unknown[]
): { valid: MissionTemplateValidated[]; errors: { index: number; issues: z.ZodIssue[] }[] } {
  const valid: MissionTemplateValidated[] = [];
  const errors: { index: number; issues: z.ZodIssue[] }[] = [];

  templates.forEach((t, i) => {
    const result = MissionTemplateSchema.safeParse(t);
    if (result.success) {
      valid.push(result.data);
    } else {
      errors.push({ index: i, issues: result.error.issues });
    }
  });

  return { valid, errors };
}
