import { rpcCall } from '@/api/client';

export const getActiveChallenges = async (...args: any[]) => rpcCall('challenge-service', 'getActiveChallenges', args);
export const getPendingChallengesForUser = async (...args: any[]) => rpcCall('challenge-service', 'getPendingChallengesForUser', args);
export const acceptChallenge = async (...args: any[]) => rpcCall('challenge-service', 'acceptChallenge', args);
export const declineChallenge = async (...args: any[]) => rpcCall('challenge-service', 'declineChallenge', args);
export const createChallenge = async (...args: any[]) => rpcCall('challenge-service', 'createChallenge', args);
