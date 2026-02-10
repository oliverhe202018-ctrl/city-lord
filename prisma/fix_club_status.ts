import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Start updating club status...')
  
  // 强制将所有俱乐部状态改为 'active'
  const result = await prisma.clubs.updateMany({
    data: {
      status: 'active'
    }
  })
  
  console.log(`Updated ${result.count} clubs to 'active' status.`)
  
  // 打印当前所有俱乐部及其状态
  const allClubs = await prisma.clubs.findMany({
      select: { id: true, name: true, status: true }
  })
  console.log('Current clubs:', allClubs)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
