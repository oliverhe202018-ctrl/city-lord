import { fetchAllBadgeTypes, fetchUserEarnedBadges, BadgeType } from "@/lib/api/badges";
import { cacheManager } from "@/lib/cache/CacheManager";

const CACHE_KEY_BADGE_TYPES = 'app:badges:types';
const CACHE_KEY_USER_EARNED = 'app:badges:earned:'; // + userId

const BADGE_TYPES_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const USER_EARNED_MAX_AGE = 5 * 60 * 1000; // 5 minutes

export class BadgeService {
  private static instance: BadgeService;

  private constructor() {}

  public static getInstance(): BadgeService {
    if (!BadgeService.instance) {
      BadgeService.instance = new BadgeService();
    }
    return BadgeService.instance;
  }

  /**
   * Get all badge definitions (Cached)
   * Priority: Memory -> IndexedDB -> Network
   */
  public async getAllBadgeTypes(forceRefresh = false): Promise<BadgeType[]> {
    // 1. Try Cache (if not forced)
    if (!forceRefresh) {
      const cached = await cacheManager.get<BadgeType[]>(CACHE_KEY_BADGE_TYPES);
      if (cached) {
        return cached;
      }
    }

    // 2. Fetch from Network
    try {
      const badges = await fetchAllBadgeTypes();
      
      // 3. Update Cache
      if (badges.length > 0) {
        await cacheManager.set(CACHE_KEY_BADGE_TYPES, badges, { 
          maxAge: BADGE_TYPES_MAX_AGE,
          persist: true 
        });
      }
      
      return badges;
    } catch (error) {
      console.error('BadgeService: Failed to fetch badge types', error);
      // If network fails, try to return stale cache if available? 
      // Current CacheManager.get returns null if expired.
      return [];
    }
  }

  /**
   * Get user earned badge IDs (Cached)
   */
  public async getUserEarnedBadgeIds(userId: string, forceRefresh = false): Promise<Set<string>> {
    const key = `${CACHE_KEY_USER_EARNED}${userId}`;

    if (!forceRefresh) {
      const cached = await cacheManager.get<string[]>(key);
      if (cached) {
        return new Set(cached);
      }
    }

    try {
      const earned = await fetchUserEarnedBadges(userId);
      const ids = earned.map(e => e.badge_id);
      
      await cacheManager.set(key, ids, { 
        maxAge: USER_EARNED_MAX_AGE,
        persist: true 
      });
      
      return new Set(ids);
    } catch (error) {
      console.error('BadgeService: Failed to fetch user badges', error);
      return new Set();
    }
  }

  /**
   * Get combined view model for UI
   * Returns all badges with 'isUnlocked' status
   */
  public async getBadgeViewModel(userId: string) {
    const [allBadges, earnedSet] = await Promise.all([
      this.getAllBadgeTypes(),
      this.getUserEarnedBadgeIds(userId)
    ]);

    return allBadges.map(badge => ({
      ...badge,
      isUnlocked: earnedSet.has(badge.id)
    }));
  }
}

export const badgeService = BadgeService.getInstance();
