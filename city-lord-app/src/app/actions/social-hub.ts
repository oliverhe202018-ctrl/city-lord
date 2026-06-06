import { rpcCall } from '@/api/client';

export const getFeedTimeline = async (...args: any[]) => rpcCall('social-hub', 'getFeedTimeline', args);
export const togglePostLike = async (...args: any[]) => rpcCall('social-hub', 'togglePostLike', args);
export const createPostComment = async (...args: any[]) => rpcCall('social-hub', 'createPostComment', args);
export const deletePostComment = async (...args: any[]) => rpcCall('social-hub', 'deletePostComment', args);
export const reportPost = async (...args: any[]) => rpcCall('social-hub', 'reportPost', args);
export const getPostComments = async (...args: any[]) => rpcCall('social-hub', 'getPostComments', args);
export const markSocialAsRead = async (...args: any[]) => rpcCall('social-hub', 'markSocialAsRead', args);
export type FeedTimelineResponse = any;
export const createPost = async (...args: any[]) => rpcCall('social-hub', 'createPost', args);
export const getRegionalRecommendations = async (...args: any[]) => rpcCall('social-hub', 'getRegionalRecommendations', args);
