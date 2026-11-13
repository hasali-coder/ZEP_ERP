import { CurrencyCode } from '../types';

/**
 * Format minor currency units (cents) into a clean, human-readable currency string.
 * Uses tabular formatting suitable for financial statements.
 */
export function formatMoney(amountCents: number, currency: CurrencyCode = 'KES', showSymbol: boolean = true): string {
  const isNegative = amountCents < 0;
  const absAmount = Math.abs(amountCents) / 100;

  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absAmount);

  const prefix = isNegative ? '-' : '';
  if (!showSymbol) {
    return `${prefix}${formattedNumber}`;
  }

  return `${prefix}${currency} ${formattedNumber}`;
}

/**
 * Safely parse user input (e.g. "20000", "20,000.50") into integer cents.
 * Eliminates floating point arithmetic errors.
 */
export function parseMoneyToCents(input: string | number | undefined | null): number {
  if (input === undefined || input === null) return 0;
  if (typeof input === 'number') {
    return Math.round(input * 100);
  }

  const cleaned = input.toString().replace(/[^0-9.-]/g, '');
  if (!cleaned || isNaN(Number(cleaned))) return 0;

  const floatVal = parseFloat(cleaned);
  return Math.round(floatVal * 100);
}

/**
 * Converts integer cents back to numeric decimal (for form inputs).
 */
export function centsToDecimal(amountCents: number): number {
  return amountCents / 100;
}

/**
 * Calculate percentage on cents with precise integer rounding.
 */
export function calculatePercentCents(baseCents: number, percent: number): number {
  if (!percent || percent <= 0) return 0;
  return Math.round((baseCents * percent) / 100);
}
