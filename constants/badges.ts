export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  iconPath: string;
  condition?: string;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'mystery-lock',
    name: 'Mystery Lock',
    description: 'Unlock this badge by completing secret missions.',
    iconPath: '/badges/mystery-lock.png',
    tier: 'bronze',
  },
  {
    id: 'first-territory',
    name: 'First Territory',
    description: 'Capture your first territory.',
    iconPath: '/badges/badge_first_territory.png',
    tier: 'bronze',
  },
  {
    id: 'city-walker',
    name: 'City Walker',
    description: 'Explore the city streets.',
    iconPath: '/badges/badge_city_walker.png',
    tier: 'bronze',
  },
  {
    id: 'marathon-god',
    name: 'Marathon God',
    description: 'Run a marathon distance.',
    iconPath: '/badges/badge_marathon_god.png',
    tier: 'gold',
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    description: 'Run with a pace faster than 4:00/km.',
    iconPath: '/badges/badge_speed_demon.png',
    tier: 'silver',
  },
  {
    id: 'early-bird',
    name: 'Early Bird',
    description: 'Complete a run before 6 AM.',
    iconPath: '/badges/badge_early_bird.png',
    tier: 'bronze',
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'Complete a run after 10 PM.',
    iconPath: '/badges/badge_night_owl.png',
    tier: 'bronze',
  },
  {
    id: 'weekend-warrior',
    name: 'Weekend Warrior',
    description: 'Run on both Saturday and Sunday.',
    iconPath: '/badges/badge_weekend_warrior.png',
    tier: 'silver',
  },
  {
    id: 'consistent-runner',
    name: 'Consistent Runner',
    description: 'Run for 7 consecutive days.',
    iconPath: '/badges/badge_consistent_runner.png',
    tier: 'gold',
  },
  {
    id: 'elevation-king',
    name: 'Elevation King',
    description: 'Gain 500m elevation in a single run.',
    iconPath: '/badges/badge_elevation_king.png',
    tier: 'platinum',
  },
  {
    id: 'social-butterfly',
    name: 'Social Butterfly',
    description: 'Run with 5 friends.',
    iconPath: '/badges/badge_social_butterfly.png',
    tier: 'silver',
  },
  {
    id: 'territory-conqueror',
    name: 'Territory Conqueror',
    description: 'Own 50 territories at once.',
    iconPath: '/badges/badge_territory_conqueror.png',
    tier: 'diamond',
  }
];
