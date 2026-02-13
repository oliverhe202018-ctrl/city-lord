
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const badges = [
  // 探索类 (Exploration)
  {
    code: 'city-explorer',
    name: 'City Explorer',
    description: 'Visit 3 different districts',
    icon_name: 'badge_city_explorer.png',
    category: 'Exploration',
    tier: 'bronze',
    requirement_type: 'districts_visited',
    requirement_value: 3,
    requirement_description: 'Visit 3 different districts'
  },
  {
    code: 'city-walker',
    name: 'City Walker',
    description: 'Walk 10km total',
    icon_name: 'badge_city_walker.png',
    category: 'Exploration',
    tier: 'bronze',
    requirement_type: 'total_distance',
    requirement_value: 10000, // meters
    requirement_description: 'Walk 10km total'
  },
  {
    code: 'early-bird',
    name: 'Early Bird',
    description: 'Complete a run before 7 AM',
    icon_name: 'badge_early_bird.png',
    category: 'Exploration',
    tier: 'silver',
    requirement_type: 'time_of_day_before',
    requirement_value: 7, // hour
    requirement_description: 'Complete a run before 7 AM'
  },
  {
    code: 'night-walker',
    name: 'Night Walker',
    description: 'Complete a run after 9 PM',
    icon_name: 'badge_night_walker.png',
    category: 'Exploration',
    tier: 'silver',
    requirement_type: 'time_of_day_after',
    requirement_value: 21, // hour
    requirement_description: 'Complete a run after 9 PM'
  },

  // 耐力类 (Endurance)
  {
    code: '100km-club',
    name: '100km Club',
    description: 'Total distance > 100km',
    icon_name: 'badge_100km.png',
    category: 'Endurance',
    tier: 'gold',
    requirement_type: 'total_distance',
    requirement_value: 100000, // meters
    requirement_description: 'Total distance > 100km'
  },
  {
    code: 'marathon-god',
    name: 'Marathon God',
    description: 'Single run > 42km',
    icon_name: 'badge_marathon_god.png',
    category: 'Endurance',
    tier: 'platinum',
    requirement_type: 'single_run_distance',
    requirement_value: 42000, // meters
    requirement_description: 'Single run > 42km'
  },
  {
    code: 'shoe-killer',
    name: 'Shoe Killer',
    description: 'Total distance > 500km',
    icon_name: 'badge_shoe_killer.png',
    category: 'Endurance',
    tier: 'platinum',
    requirement_type: 'total_distance',
    requirement_value: 500000, // meters
    requirement_description: 'Total distance > 500km'
  },

  // 征服类 (Conquest)
  {
    code: 'first-territory',
    name: 'First Territory',
    description: 'Capture 1st territory',
    icon_name: 'badge_first_territory.png',
    category: 'Conquest',
    tier: 'bronze',
    requirement_type: 'total_territories',
    requirement_value: 1,
    requirement_description: 'Capture 1st territory'
  },
  {
    code: 'landlord',
    name: 'Landlord',
    description: 'Hold 10 territories simultaneously',
    icon_name: 'badge_landlord.png',
    category: 'Conquest',
    tier: 'gold',
    requirement_type: 'current_territories',
    requirement_value: 10,
    requirement_description: 'Hold 10 territories simultaneously'
  },
  {
    code: 'territory-raider',
    name: 'Territory Raider',
    description: 'Capture 50 territories total',
    icon_name: 'badge_territory_raider.png',
    category: 'Conquest',
    tier: 'platinum',
    requirement_type: 'total_territories',
    requirement_value: 50,
    requirement_description: 'Capture 50 territories total'
  },

  // 速度类 (Speed)
  {
    code: 'flash',
    name: 'Flash',
    description: 'Pace < 4\'00"/km for 5km',
    icon_name: 'badge_flash.png',
    category: 'Speed',
    tier: 'gold',
    requirement_type: 'pace_for_distance',
    requirement_value: 240, // seconds per km
    requirement_description: 'Pace < 4\'00"/km for 5km'
  },
  {
    code: 'wind-chaser',
    name: 'Wind Chaser',
    description: 'Top speed > 15km/h',
    icon_name: 'badge_wind_chaser_gold.png',
    category: 'Speed',
    tier: 'silver',
    requirement_type: 'max_speed',
    requirement_value: 15, // km/h
    requirement_description: 'Top speed > 15km/h'
  },

  // 特殊类 (Special)
  {
    code: 'social-star',
    name: 'Social Star',
    description: 'Invite 5 friends',
    icon_name: 'badge_starting_line.png',
    category: 'Special',
    tier: 'silver',
    requirement_type: 'invites',
    requirement_value: 5,
    requirement_description: 'Invite 5 friends'
  },
  {
    code: 'mysterious',
    name: 'Mysterious',
    description: 'Hidden achievement',
    icon_name: 'a-cute-mysterious-padlock-with-a-glowing-keyhole--.png',
    category: 'Special',
    tier: 'platinum',
    requirement_type: 'hidden',
    requirement_value: 1,
    requirement_description: 'Hidden achievement'
  }
]

async function main() {
  console.log('Start seeding badges...')

  for (const badge of badges) {
    await prisma.badges.upsert({
      where: { code: badge.code },
      update: badge,
      create: badge,
    })
    console.log(`Upserted badge: ${badge.name}`)
  }

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
