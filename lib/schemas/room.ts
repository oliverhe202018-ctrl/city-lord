import { z } from 'zod';

export const CreateRoomSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(50, '名称过长'),
  password: z.string().max(20, '密码过长').optional(),
});

export const JoinRoomSchema = z.object({
  roomId: z.string().uuid('无效的房间ID'),
  password: z.string().max(20).optional(),
});

export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type JoinRoomInput = z.infer<typeof JoinRoomSchema>;
