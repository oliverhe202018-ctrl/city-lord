/**
 * Formats a date/timestamp/string to CST (Asia/Shanghai)
 */
export function formatCST(
  ts: string | number | Date | null | undefined,
  formatType: 'YYYY-MM-DD' | 'YYYY-MM-DD HH:mm' | 'YYYY-MM-DD HH:mm:ss' | 'MM-DD' | 'HH:mm' | 'MM-DD HH:mm' | 'MM月DD日' | 'string' = 'YYYY-MM-DD HH:mm:ss'
): string {
  if (!ts) return '';
  const date = new Date(ts);
  if (isNaN(date.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = getPart('hour');
  const minute = getPart('minute');
  const second = getPart('second');

  switch (formatType) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'YYYY-MM-DD HH:mm':
      return `${year}-${month}-${day} ${hour}:${minute}`;
    case 'MM-DD':
      return `${month}-${day}`;
    case 'MM月DD日':
      return `${parseInt(month)}月${parseInt(day)}日`;
    case 'HH:mm':
      return `${hour}:${minute}`;
    case 'MM-DD HH:mm':
      return `${month}-${day} ${hour}:${minute}`;
    case 'string':
      return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
    case 'YYYY-MM-DD HH:mm:ss':
    default:
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }
}
