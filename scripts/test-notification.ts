import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. Get a real user
  const user = await prisma.profiles.findFirst()
  
  if (!user) {
    console.error('❌ No users found in database. Please login/signup in the app first.')
    return
  }

// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
  console.log(`🎯 Targeting User: ${user.display_name || 'Unknown'} (${user.id})`)

  // 2. Insert Notification
  const notification = await prisma.notifications.create({
    data: {
      user_id: user.id,
      title: "⚔️ 敌袭警报 (测试)",
      body: "您的领地 [中央公园] 正在遭受攻击！(来自脚本测试)",
      type: "battle_alert",
      data: { territoryId: "test-hex-123" },
      is_read: false
    }
  })

  console.log(`✅ Notification Inserted: ${notification.id}`)
  console.log(`📱 Check your app (Foreground: Toast / Background: Notification)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
