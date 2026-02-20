import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Spinner, LoadingSpinner } from '@/components/ui/spinner';

describe('Spinner component', () => {
  // -- Rendering --

  it('should render an SVG element', () => {
    render(<Spinner />);
    const spinner = screen.getByLabelText('Loading');
    expect(spinner.tagName.toLowerCase()).toBe('svg');
  });

  it('should have aria-label "Loading"', () => {
    render(<Spinner />);
    expect(screen.getByLabelText('Loading')).toBeTruthy();
  });

  it('should have animate-spin class', () => {
    render(<Spinner />);
    const spinner = screen.getByLabelText('Loading');
    const className = spinner.className.baseVal || spinner.getAttribute('class') || '';
    expect(className).toContain('animate-spin');
  });

  // -- Sizes --

  it('should apply medium size by default (h-8 w-8)', () => {
    render(<Spinner />);
    const spinner = screen.getByLabelText('Loading');
    const className = spinner.className.baseVal || spinner.getAttribute('class') || '';
    expect(className).toContain('h-8');
    expect(className).toContain('w-8');
  });

  it('should apply small size (h-4 w-4)', () => {
    render(<Spinner size="sm" />);
    const spinner = screen.getByLabelText('Loading');
    const className = spinner.className.baseVal || spinner.getAttribute('class') || '';
    expect(className).toContain('h-4');
    expect(className).toContain('w-4');
  });

  it('should apply large size (h-12 w-12)', () => {
    render(<Spinner size="lg" />);
    const spinner = screen.getByLabelText('Loading');
    const className = spinner.className.baseVal || spinner.getAttribute('class') || '';
    expect(className).toContain('h-12');
    expect(className).toContain('w-12');
  });

  // -- Custom className --

  it('should accept custom className', () => {
    render(<Spinner className="custom-spin" />);
    const spinner = screen.getByLabelText('Loading');
    const className = spinner.className.baseVal || spinner.getAttribute('class') || '';
    expect(className).toContain('custom-spin');
  });

  // -- Full Page --

  it('should render in a centered container when fullPage is true', () => {
    const { container } = render(<Spinner fullPage />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('min-h-screen');
    expect(wrapper.className).toContain('flex');
    expect(wrapper.className).toContain('items-center');
    expect(wrapper.className).toContain('justify-center');
  });

  it('should render directly without wrapper when fullPage is false', () => {
    const { container } = render(<Spinner />);
    const element = container.firstElementChild as HTMLElement;
    // Should be the SVG directly, not a wrapper div
    expect(element.tagName.toLowerCase()).toBe('svg');
  });
});

describe('LoadingSpinner component', () => {
  it('should render a large spinner', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByLabelText('Loading');
    const className = spinner.className.baseVal || spinner.getAttribute('class') || '';
    expect(className).toContain('h-12');
    expect(className).toContain('w-12');
  });

  it('should render full page when fullPage is true', () => {
    const { container } = render(<LoadingSpinner fullPage />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('min-h-screen');
  });
});
