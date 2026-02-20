// Extend vitest matchers with jest-dom (toBeInTheDocument, toBeDisabled, etc.)
// Uses a try/catch because transitive dependencies may not resolve in all
// monorepo node_modules configurations.
try {
  await import('@testing-library/jest-dom/vitest');
} catch {
  // Fallback: manually extend expect with common matchers
  const { expect } = await import('vitest');

  expect.extend({
    toBeInTheDocument(received: unknown) {
      const element = received as Element | null;
      const pass = element !== null && element !== undefined && element.ownerDocument?.contains(element);
      return {
        pass,
        message: () => pass
          ? `expected element not to be in the document`
          : `expected element to be in the document`,
      };
    },
    toBeDisabled(received: unknown) {
      const element = received as HTMLElement;
      const pass = element.hasAttribute('disabled') || (element as HTMLButtonElement).disabled === true;
      return {
        pass,
        message: () => pass
          ? `expected element not to be disabled`
          : `expected element to be disabled`,
      };
    },
    toBeEnabled(received: unknown) {
      const element = received as HTMLElement;
      const pass = !element.hasAttribute('disabled');
      return {
        pass,
        message: () => pass
          ? `expected element not to be enabled`
          : `expected element to be enabled`,
      };
    },
    toBeVisible(received: unknown) {
      const element = received as HTMLElement;
      const pass = element !== null && element !== undefined;
      return {
        pass,
        message: () => pass
          ? `expected element not to be visible`
          : `expected element to be visible`,
      };
    },
    toHaveTextContent(received: unknown, expected: string | RegExp) {
      const element = received as HTMLElement;
      const textContent = element.textContent || '';
      const pass = typeof expected === 'string'
        ? textContent.includes(expected)
        : expected.test(textContent);
      return {
        pass,
        message: () => pass
          ? `expected element not to have text content "${expected}"`
          : `expected element to have text content "${expected}" but got "${textContent}"`,
      };
    },
    toBeEditable(received: unknown) {
      const element = received as HTMLInputElement;
      const pass = !element.readOnly && !element.disabled;
      return {
        pass,
        message: () => pass
          ? `expected element not to be editable`
          : `expected element to be editable`,
      };
    },
  });
}

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});

// Mock crypto.randomUUID
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => '00000000-0000-0000-0000-000000000000',
      getRandomValues: (arr: Uint8Array) => arr,
    },
  });
}
