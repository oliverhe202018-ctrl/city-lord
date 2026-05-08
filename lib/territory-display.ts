const SHORT_CODE_MOD = 100000;

function toShortCode(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return String(hash % SHORT_CODE_MOD).padStart(5, '0');
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

export interface TerritoryDisplayContext {
  id: string;
  customName: string | null;
  clubName?: string | null;
  ownerNickname?: string | null;
}

export function getTerritoryDisplayName(ctx: TerritoryDisplayContext): string {
  if (ctx.customName) return truncate(ctx.customName, 10);
  if (ctx.clubName) return truncate(ctx.clubName, 8);
  if (ctx.ownerNickname) return truncate(ctx.ownerNickname, 6) + '的领地';
  return `领地_${toShortCode(ctx.id)}`;
}
