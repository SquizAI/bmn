import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

describe('Card component', () => {
  // -- Rendering --

  it('should render children', () => {
    render(<Card>Card content here</Card>);
    expect(screen.getByText('Card content here')).toBeTruthy();
  });

  it('should render as a div element', () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.tagName).toBe('DIV');
  });

  // -- Variants --

  it('should apply default variant classes', () => {
    render(<Card data-testid="card">Default</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-surface');
    expect(card.className).toContain('border');
  });

  it('should apply elevated variant classes', () => {
    render(<Card variant="elevated" data-testid="card">Elevated</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-surface-elevated');
    expect(card.className).toContain('shadow-sm');
  });

  it('should apply outlined variant classes', () => {
    render(<Card variant="outlined" data-testid="card">Outlined</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-transparent');
    expect(card.className).toContain('border');
  });

  it('should apply interactive variant classes', () => {
    render(<Card variant="interactive" data-testid="card">Interactive</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('cursor-pointer');
  });

  // -- Padding --

  it('should apply medium padding by default', () => {
    render(<Card data-testid="card">Padded</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('p-6');
  });

  it('should apply small padding', () => {
    render(<Card padding="sm" data-testid="card">Small pad</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('p-4');
  });

  it('should apply large padding', () => {
    render(<Card padding="lg" data-testid="card">Large pad</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('p-8');
  });

  it('should apply no padding', () => {
    render(<Card padding="none" data-testid="card">No pad</Card>);
    const card = screen.getByTestId('card');
    // Should not have any p- class (none maps to empty string)
    expect(card.className).not.toContain('p-4');
    expect(card.className).not.toContain('p-6');
    expect(card.className).not.toContain('p-8');
  });

  // -- Rounded --

  it('should always have rounded-lg class', () => {
    render(<Card data-testid="card">Rounded</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('rounded-lg');
  });

  // -- Custom className --

  it('should accept custom className', () => {
    render(<Card className="custom-card" data-testid="card">Custom</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('custom-card');
  });
});

describe('CardHeader component', () => {
  it('should render children', () => {
    render(<CardHeader>Header Content</CardHeader>);
    expect(screen.getByText('Header Content')).toBeTruthy();
  });

  it('should apply flex layout classes', () => {
    render(<CardHeader data-testid="header">Test</CardHeader>);
    const header = screen.getByTestId('header');
    expect(header.className).toContain('flex');
    expect(header.className).toContain('items-center');
  });
});

describe('CardTitle component', () => {
  it('should render as an h3 element', () => {
    render(<CardTitle>Title</CardTitle>);
    const title = screen.getByText('Title');
    expect(title.tagName).toBe('H3');
  });

  it('should apply font-semibold class', () => {
    render(<CardTitle>Title</CardTitle>);
    const title = screen.getByText('Title');
    expect(title.className).toContain('font-semibold');
  });
});

describe('CardDescription component', () => {
  it('should render as a paragraph', () => {
    render(<CardDescription>Description text</CardDescription>);
    const desc = screen.getByText('Description text');
    expect(desc.tagName).toBe('P');
  });

  it('should apply text-sm class', () => {
    render(<CardDescription>Description text</CardDescription>);
    const desc = screen.getByText('Description text');
    expect(desc.className).toContain('text-sm');
  });
});

describe('CardContent component', () => {
  it('should render children', () => {
    render(<CardContent>Body content</CardContent>);
    expect(screen.getByText('Body content')).toBeTruthy();
  });
});

describe('CardFooter component', () => {
  it('should render children', () => {
    render(<CardFooter>Footer content</CardFooter>);
    expect(screen.getByText('Footer content')).toBeTruthy();
  });

  it('should apply flex layout classes', () => {
    render(<CardFooter data-testid="footer">Test</CardFooter>);
    const footer = screen.getByTestId('footer');
    expect(footer.className).toContain('flex');
    expect(footer.className).toContain('items-center');
  });
});
