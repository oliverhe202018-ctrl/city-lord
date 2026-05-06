import { z } from 'zod';

export const CreateClubSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(50, '名称过长'),
  description: z.string().max(500, '描述过长').optional(),
  avatar_url: z.string().url('无效的图片URL').optional().or(z.literal('')),
  province: z.string().optional(),
  is_public: z.boolean().optional().default(true),
});

export const UpdateClubInfoSchema = z.object({
  clubId: z.string().uuid('无效的俱乐部ID'), // usually part of URL or body?
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

export const ProcessJoinRequestSchema = z.object({
  clubId: z.string().uuid(),
  requestId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
});

export const ClubMemberActionSchema = z.object({
  clubId: z.string().uuid(),
  memberId: z.string().uuid(),
});

export const JoinClubSchema = z.object({
  clubId: z.string().uuid(),
});

export const LeaveClubSchema = z.object({
  clubId: z.string().uuid(),
});

export const AdminCreateClubSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  description: z.string().optional(),
  province: z.string().min(1, '省份不能为空'),
  avatar_url: z.string().url().optional().or(z.literal('')),
});

export type CreateClubInput = z.infer<typeof CreateClubSchema>;
export type UpdateClubInfoInput = z.infer<typeof UpdateClubInfoSchema>;
export type ProcessJoinRequestInput = z.infer<typeof ProcessJoinRequestSchema>;
export type ClubMemberActionInput = z.infer<typeof ClubMemberActionSchema>;
export type AdminCreateClubInput = z.infer<typeof AdminCreateClubSchema>;
