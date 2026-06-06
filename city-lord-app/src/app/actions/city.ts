import { rpcCall } from '@/api/client';

export const claimTerritory = async (...args: any[]) => rpcCall('city', 'claimTerritory', args);
export const fetchTerritories = async (...args: any[]) => rpcCall('city', 'fetchTerritories', args);
export const fetchCityStats = async (...args: any[]) => rpcCall('city', 'fetchCityStats', args);
export const fetchCityLeaderboard = async (...args: any[]) => rpcCall('city', 'fetchCityLeaderboard', args);
export const getUserCityProgress = async (...args: any[]) => rpcCall('city', 'getUserCityProgress', args);
export type CityLeaderboardEntry = any;
export const getOrCreateCityByAdcode = async (...args: any[]) => rpcCall('city', 'getOrCreateCityByAdcode', args);
export const getCityDetailsFromDb = async (...args: any[]) => rpcCall('city', 'getCityDetailsFromDb', args);
