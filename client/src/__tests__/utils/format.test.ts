import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber, truncate, capitalize } from '@/lib/utils';

describe('formatCurrency', () => {
  it('should format zero as $0.00', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should format 1234.56 as $1,234.56', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('should format 1000000 as $1,000,000.00', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });

  it('should format negative amounts', () => {
    expect(formatCurrency(-50)).toBe('-$50.00');
  });

  it('should format small decimal amounts', () => {
    expect(formatCurrency(0.99)).toBe('$0.99');
  });

  it('should round to 2 decimal places', () => {
    expect(formatCurrency(19.999)).toBe('$20.00');
  });

  it('should handle whole numbers', () => {
    expect(formatCurrency(100)).toBe('$100.00');
  });
});

describe('formatNumber', () => {
  it('should format zero as "0"', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('should format 1234 with comma separator', () => {
    expect(formatNumber(1234)).toBe('1,234');
  });

  it('should format large numbers with multiple commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('should format small numbers without commas', () => {
    expect(formatNumber(999)).toBe('999');
  });

  it('should handle negative numbers', () => {
    expect(formatNumber(-5000)).toBe('-5,000');
  });
});

describe('truncate', () => {
  it('should return the original string if shorter than maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('should truncate and add ellipsis when string exceeds maxLength', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('should return the original string if exactly maxLength', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('should handle empty strings', () => {
    expect(truncate('', 5)).toBe('');
  });
});

describe('capitalize', () => {
  it('should capitalize the first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('should return empty string for empty input', () => {
    expect(capitalize('')).toBe('');
  });

  it('should not change already capitalized strings', () => {
    expect(capitalize('Hello')).toBe('Hello');
  });

  it('should handle single character strings', () => {
    expect(capitalize('a')).toBe('A');
  });
});
