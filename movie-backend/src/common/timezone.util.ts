export const APP_TIME_ZONE = 'Europe/Kyiv';

function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

export function startOfDayInTimeZone(
  timeZone: string,
  reference: Date = new Date(),
): Date {
  const offsetMs = getTimeZoneOffsetMs(timeZone, reference);
  const shifted = new Date(reference.getTime() + offsetMs);
  const localMidnightAsUtcDigits = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  return new Date(localMidnightAsUtcDigits - offsetMs);
}

export function nextStartOfDayInTimeZone(
  timeZone: string,
  reference: Date = new Date(),
): Date {
  const todayStart = startOfDayInTimeZone(timeZone, reference);
  const probablyTomorrow = new Date(todayStart.getTime() + 26 * 60 * 60 * 1000);
  return startOfDayInTimeZone(timeZone, probablyTomorrow);
}

export function dateStringInTimeZone(
  timeZone: string,
  reference: Date = new Date(),
): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(reference);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}
