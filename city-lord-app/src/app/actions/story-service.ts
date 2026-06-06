import { rpcCall } from '@/api/client';

export const generateRunStory = async (...args: any[]) => rpcCall('story-service', 'generateRunStory', args);
