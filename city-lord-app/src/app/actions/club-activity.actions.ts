import { rpcCall } from '@/api/client';

export const getClubActivities = async (...args: any[]) => rpcCall('club-activity.actions', 'getClubActivities', args);
export const registerForActivity = async (...args: any[]) => rpcCall('club-activity.actions', 'registerForActivity', args);
export const cancelRegistration = async (...args: any[]) => rpcCall('club-activity.actions', 'cancelRegistration', args);
export const getActivityRegistrations = async (...args: any[]) => rpcCall('club-activity.actions', 'getActivityRegistrations', args);
export const createActivity = async (...args: any[]) => rpcCall('club-activity.actions', 'createActivity', args);
