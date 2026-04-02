const SHANGHAI_TZ = 'Asia/Shanghai';

function toParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

export function getShanghaiDateString(date = new Date()) {
  const p = toParts(date, SHANGHAI_TZ);
  return `${p.year}-${p.month}-${p.day}`;
}

export function getTodayDateStringByTimezone(timezone = SHANGHAI_TZ, date = new Date()) {
  const p = toParts(date, timezone);
  return `${p.year}-${p.month}-${p.day}`;
}
