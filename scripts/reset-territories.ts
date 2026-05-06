import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const isDryRun = process.argv.includes('--dry-run');
const autoConfirm = process.argv.includes('--confirm');

async function prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

async function main() {
  console.log('==============================================');
  console.log('领地数据重置脚本 (Territory Reset Script V2) ');
  console.log('==============================================');
  
  if (isDryRun) {
      console.log('>> [DRY RUN MODE] 不会真实删除任何数据。');
  } else {
      console.log('>> [DANGER] 正在以真实模式运行，将永久删除数据。');
  }

  console.log('\n[清理范围] (Cleanup Scope):');
  console.log(' - ❌ 将被清除: territories, territory_events, territory_hp_logs, territory_owner_change_logs');
  console.log(' - ✅ 将受保护: profiles, runs, 以及与核心领地系统无关的所有业务表\n');

  if (!isDryRun && !autoConfirm) {
      const answer = await prompt('是否已完成数据库 Snapshot 备份并且确认要清空旧版领地数据？(yes/no): ');
      if (answer.toLowerCase() !== 'yes') {
          console.log('已取消执行。');
          process.exit(0);
      }
  }

  try {
    // 1. 删除领地历史事件记录
    console.log('\n[1/4] 正在统计 territory_events...');
    const eventCount = await prisma.territory_events.count();
    console.log(`将删除 ${eventCount} 条 territory_events 记录。`);
    if (!isDryRun) await prisma.territory_events.deleteMany({});

    // 2. 删除 HP 日志
    try {
      console.log('\n[2/4] 正在统计 territory_hp_logs...');
      const hpCount = await prisma.territory_hp_logs.count();
      console.log(`将删除 ${hpCount} 条 territory_hp_logs 记录。`);
      if (!isDryRun) await prisma.territory_hp_logs.deleteMany({});
    } catch(e: any) {
      if (e.code === 'P2021') console.log(`[Skip] territory_hp_logs table does not exist.`);
      else throw e;
    }

    // 3. 删除归属变更记录
    try {
      console.log('\n[3/4] 正在统计 territory_owner_change_logs...');
      const ownerCountRows = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint as count FROM public.territory_owner_change_logs`;
      const ownerCount = Number(ownerCountRows[0]?.count || 0);
      console.log(`将删除 ${ownerCount} 条 territory_owner_change_logs 记录。`);
      if (!isDryRun) {
        await prisma.$executeRaw`DELETE FROM public.territory_owner_change_logs`;
      }
    } catch(e: any) {
      if (e.code === 'P2021') console.log(`[Skip] territory_owner_change_logs table does not exist.`);
      else throw e;
    }

    // 4. 删除所有的领地主表记录
    console.log('\n[4/4] 正在统计 territories...');
    const territoryCount = await prisma.territories.count();
    console.log(`将删除 ${territoryCount} 条 territories 记录。`);
    if (!isDryRun) await prisma.territories.deleteMany({});

    console.log('\n✅ 领地数据重置逻辑执行完毕！你可以重新运行生成纯 Polygon 领地了。');
    
  } catch (error) {
    console.error('\n❌ 执行领地数据重置时发生错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main().catch(console.error);
