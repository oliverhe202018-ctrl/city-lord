import React from "react"
import { 
  Trophy, 
  Star, 
  Zap, 
  Shield, 
  MapPin, 
  Target, 
  Crown, 
  Moon, 
  Sun, 
  Footprints, 
  Compass, 
  Flag, 
  Award,
  Medal,
  Flame,
  Droplets,
  Wind,
  Mountain,
  Sword,
  Scroll,
  Book,
  Map as MapIcon,
  Globe,
  Axe,
  Sunrise,
  Swords,
  Navigation
} from "lucide-react"

interface BadgeIconProps {
  iconName: string
  className?: string
}

export function BadgeIcon({ iconName, className }: BadgeIconProps) {
  // Normalize icon name to lowercase and remove potential file extensions or prefixes
  const normalizedName = iconName?.toLowerCase().replace('.svg', '').replace('.png', '') || 'award'

  switch (normalizedName) {
    // Exploration
    case 'map-pin':
    case 'map_pin':
    case 'location':
      return <MapPin className={className} />
    case 'compass':
      return <Compass className={className} />
    case 'navigation':
      return <Navigation className={className} />
    case 'footprints':
    case 'steps':
    case 'walk':
      return <Footprints className={className} />
    case 'flag':
    case 'marker':
      return <Flag className={className} />
    case 'mountain':
    case 'peak':
      return <Mountain className={className} />
    case 'map':
      return <MapIcon className={className} />
    case 'globe':
      return <Globe className={className} />

    // Endurance
    case 'zap':
    case 'lightning':
    case 'energy':
      return <Zap className={className} />
    case 'flame':
    case 'fire':
    case 'burn':
      return <Flame className={className} />
    case 'droplets':
    case 'sweat':
    case 'water':
      return <Droplets className={className} />
    case 'wind':
    case 'speed':
      return <Wind className={className} />

    // Conquest
    case 'shield':
    case 'defense':
      return <Shield className={className} />
    case 'sword':
    case 'attack':
    case 'battle':
      return <Sword className={className} />
    case 'axe':
      return <Axe className={className} />
    case 'swords':
      return <Swords className={className} />
    case 'target':
    case 'aim':
      return <Target className={className} />
    case 'crown':
    case 'king':
    case 'lord':
      return <Crown className={className} />
    case 'trophy':
    case 'cup':
      return <Trophy className={className} />

    // Special / Hidden
    case 'moon':
    case 'night':
    case 'night_owl':
      return <Moon className={className} />
    case 'sun':
    case 'day':
      return <Sun className={className} />
    case 'sunrise':
    case 'early_bird':
      return <Sunrise className={className} />
    case 'star':
    case 'special':
      return <Star className={className} />
    case 'medal':
      return <Medal className={className} />
    case 'scroll':
    case 'quest':
      return <Scroll className={className} />
    case 'book':
    case 'lore':
      return <Book className={className} />
      
    // Default
    default:
      return <Award className={className} />
  }
}
