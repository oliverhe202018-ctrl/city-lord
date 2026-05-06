import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Start deduplicating clubs...')
  
  // 1. 获取所有重复的名称
  const clubs = await prisma.clubs.groupBy({
      by: ['name'],
      _count: {
          name: true
      },
      having: {
          name: {
              _count: {
                  gt: 1
              }
          }
      }
  })

  console.log(`Found ${clubs.length} duplicate club names.`)

  for (const group of clubs) {
      console.log(`Processing duplicate: ${group.name}`)
      
      // 2. 获取该名称的所有俱乐部
      const duplicates = await prisma.clubs.findMany({
          where: { name: group.name },
          orderBy: { created_at: 'asc' } // 保留最早创建的
      })

      // 3. 重命名或删除
      // 策略：保留第一个，其余的重命名为 "Name (1)", "Name (2)"...
      for (let i = 1; i < duplicates.length; i++) {
          const club = duplicates[i]
          const newName = `${group.name} (${i})`
          console.log(`Renaming club ${club.id} from "${club.name}" to "${newName}"`)
          
          await prisma.clubs.update({
              where: { id: club.id },
              data: { name: newName }
          })
      }
  }

  console.log('Deduplication finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
