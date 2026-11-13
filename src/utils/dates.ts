export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '—';
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
    }
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function isDateOverdue(dueDateString: string): boolean {
  if (!dueDateString) return false;
  const today = getTodayDateString();
  return dueDateString < today;
}

export function getDaysDiff(fromDateString: string, toDateString: string): number {
  const from = new Date(fromDateString).getTime();
  const to = new Date(toDateString).getTime();
  const diffTime = to - from;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';

export function getAgingBucket(dueDateString: string): AgingBucket {
  const today = getTodayDateString();
  if (dueDateString >= today) {
    return 'current';
  }
  const daysOverdue = getDaysDiff(dueDateString, today);
  if (daysOverdue <= 30) return '1-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}

export interface DateRangePreset {
  label: string;
  startDate: string;
  endDate: string;
}

export function getDatePresets(): DateRangePreset[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const pad = (n: number) => String(n).padStart(2, '0');

  // This month
  const startThisMonth = `${year}-${pad(month + 1)}-01`;
  const lastDayThisMonth = new Date(year, month + 1, 0).getDate();
  const endThisMonth = `${year}-${pad(month + 1)}-${pad(lastDayThisMonth)}`;

  // Last month
  const lastMonthYear = month === 0 ? year - 1 : year;
  const lastMonth = month === 0 ? 11 : month - 1;
  const lastDayLastMonth = new Date(lastMonthYear, lastMonth + 1, 0).getDate();
  const startLastMonth = `${lastMonthYear}-${pad(lastMonth + 1)}-01`;
  const endLastMonth = `${lastMonthYear}-${pad(lastMonth + 1)}-${pad(lastDayLastMonth)}`;

  // Last 30 days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const start30Days = `${thirtyDaysAgo.getFullYear()}-${pad(thirtyDaysAgo.getMonth() + 1)}-${pad(thirtyDaysAgo.getDate())}`;
  const endToday = getTodayDateString();

  // Year to Date
  const startYtd = `${year}-01-01`;

  return [
    { label: 'This Month', startDate: startThisMonth, endDate: endThisMonth },
    { label: 'Last Month', startDate: startLastMonth, endDate: endLastMonth },
    { label: 'Last 30 Days', startDate: start30Days, endDate: endToday },
    { label: 'Year to Date', startDate: startYtd, endDate: endToday },
    { label: 'All Time', startDate: '2020-01-01', endDate: '2099-12-31' },
  ];
}
