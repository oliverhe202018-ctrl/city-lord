const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Query all tables and columns from the actual database
  const columns = await prisma.$queryRaw`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
  `;

  const dbSchema = {};
  for (const row of columns) {
    if (!dbSchema[row.table_name]) {
      dbSchema[row.table_name] = [];
    }
    dbSchema[row.table_name].push(row.column_name);
  }

  // Parse new schema
  const content = fs.readFileSync('prisma/schema.prisma', 'utf-8');
  const newModels = {};
  let currentModel = null;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;
    
    const m = trimmed.match(/^model\s+([A-Za-z0-9_]+)\s*\{/);
    if (m) {
      currentModel = m[1];
      newModels[currentModel] = [];
      continue;
    }
    if (currentModel && trimmed === '}') {
      currentModel = null;
      continue;
    }
    if (currentModel) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2 && !trimmed.startsWith('@@')) {
        newModels[currentModel].push(parts[0]);
      }
    }
  }

  // Generate SQL
  // Rule: for each new model, if there is a corresponding table in DB that needs renaming, we rename it.
  // Then we check columns.

  const toSnakePlural = (name) => {
    let s1 = name.replace(/(.)([A-Z][a-z]+)/g, '$1_$2');
    let snake = s1.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    if (snake === 'reward_log') return 'reward_logs';
    if (snake === 'exp_log') return 'exp_logs';
    if (snake === 'user_wallet') return 'user_wallets';
    if (snake === 'wallet_transaction') return 'wallet_transactions';
    if (snake === 'daily_stat') return 'daily_stats';
    if (snake === 'province_stat') return 'province_stats';
    if (snake === 'faction_stats_cache') return 'faction_stats_caches';
    if (snake === 'territories_backup_20260301') return 'territories_backup_20260301';
    return snake;
  };

  const sql = ['BEGIN;'];

  // Table Renames
  const tableMappings = [];
  for (const oldTable of Object.keys(dbSchema)) {
    if (oldTable === 'storeItem') continue;
    if (oldTable.startsWith('_prisma')) continue;

    let targetNewTable = toSnakePlural(oldTable);
    
    // Hardcoded overrides from our old schema mappings if needed
    if (oldTable === '_territories_backup_20260301') targetNewTable = 'territories_backup_20260301';

    if (!newModels[targetNewTable] && newModels[oldTable]) {
      targetNewTable = oldTable;
    }

    if (newModels[targetNewTable]) {
      tableMappings.push({ oldT: oldTable, newT: targetNewTable });
      if (oldTable !== targetNewTable) {
        sql.push(`ALTER TABLE "${oldTable}" RENAME TO "${targetNewTable}";`);
      }
    }
  }

  const toSnake = (name) => {
    let s1 = name.replace(/(.)([A-Z][a-z]+)/g, '$1_$2');
    return s1.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  };

  // Column Renames
  for (const mapping of tableMappings) {
    const { oldT, newT } = mapping;
    const dbCols = dbSchema[oldT];
    const newCols = newModels[newT];

    for (const oldCol of dbCols) {
      // Find what it should be renamed to.
      // Usually, it's just the snake_case version of the old name.
      const expectedNew = toSnake(oldCol);
      if (expectedNew !== oldCol && newCols.includes(expectedNew)) {
        // We need to rename!
        // The table is currently named `newT` because we already renamed the table in the statements above.
        sql.push(`ALTER TABLE "${newT}" RENAME COLUMN "${oldCol}" TO "${expectedNew}";`);
      }
    }
  }

  sql.push('COMMIT;');

  console.log(sql.join('\n'));
}

main().catch(console.error).finally(() => prisma.$disconnect());
