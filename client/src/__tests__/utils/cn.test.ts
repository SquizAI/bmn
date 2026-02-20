import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (class name utility)', () => {
  it('should merge two simple class strings', () => {
    const result = cn('a', 'b');
    expect(result).toContain('a');
    expect(result).toContain('b');
  });

  it('should filter out falsy values', () => {
    const result = cn('a', false && 'b', undefined, null, 'c');
    expect(result).toContain('a');
    expect(result).toContain('c');
    expect(result).not.toContain('b');
  });

  it('should handle Tailwind class conflicts by keeping the last one', () => {
    // twMerge should resolve px-2 vs px-4 in favor of px-4
    const result = cn('px-2', 'px-4');
    expect(result).toBe('px-4');
  });

  it('should merge padding conflicts correctly', () => {
    const result = cn('p-2', 'p-4');
    expect(result).toBe('p-4');
  });

  it('should handle background color conflicts', () => {
    const result = cn('bg-red-500', 'bg-blue-500');
    expect(result).toBe('bg-blue-500');
  });

  it('should preserve non-conflicting classes', () => {
    const result = cn('px-2 py-4', 'bg-red-500 text-white');
    expect(result).toContain('px-2');
    expect(result).toContain('py-4');
    expect(result).toContain('bg-red-500');
    expect(result).toContain('text-white');
  });

  it('should handle empty input', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('should handle conditional classes with objects', () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn('base', { 'is-active': isActive, 'is-disabled': isDisabled });
    expect(result).toContain('base');
    expect(result).toContain('is-active');
    expect(result).not.toContain('is-disabled');
  });

  it('should handle array inputs', () => {
    const result = cn(['a', 'b'], 'c');
    expect(result).toContain('a');
    expect(result).toContain('b');
    expect(result).toContain('c');
  });

  it('should handle text size conflicts', () => {
    const result = cn('text-sm', 'text-lg');
    expect(result).toBe('text-lg');
  });
});
