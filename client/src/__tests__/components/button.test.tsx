import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '@/components/ui/button';

describe('Button component', () => {
  // -- Rendering --

  it('should render with text content', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeTruthy();
  });

  it('should render as a button element', () => {
    render(<Button>Test</Button>);
    const button = screen.getByRole('button');
    expect(button.tagName).toBe('BUTTON');
  });

  // -- Variants --

  it('should apply primary variant classes by default', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-primary');
  });

  it('should apply outline variant classes', () => {
    render(<Button variant="outline">Outline</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('border');
    expect(button.className).toContain('bg-transparent');
  });

  it('should apply ghost variant classes', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-transparent');
  });

  it('should apply danger variant classes', () => {
    render(<Button variant="danger">Danger</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-error');
  });

  it('should apply secondary variant classes', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-secondary');
  });

  // -- Sizes --

  it('should apply medium size classes by default', () => {
    render(<Button>Default Size</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('h-9');
  });

  it('should apply small size classes', () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('h-8');
  });

  it('should apply large size classes', () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('h-11');
  });

  // -- Loading State --

  it('should be disabled when loading', () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByRole('button');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('should show spinner when loading', () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByRole('button');
    // Loader2 from lucide-react renders as an SVG with animate-spin class
    const svg = button.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.className.baseVal || svg?.getAttribute('class') || '').toContain('animate-spin');
  });

  // -- Disabled State --

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('should have reduced opacity when disabled', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('disabled:opacity-50');
  });

  // -- Click Handler --

  it('should fire onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not fire onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  // -- Full Width --

  it('should apply full width class when fullWidth is true', () => {
    render(<Button fullWidth>Full Width</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('w-full');
  });

  // -- Custom className --

  it('should accept and apply custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('custom-class');
  });
});
