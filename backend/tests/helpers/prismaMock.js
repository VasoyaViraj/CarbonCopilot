import { vi } from 'vitest';

/** In-memory stand-in for the Prisma client; tests configure return values per case. */
export function createPrismaMock() {
  const mock = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    organization: { create: vi.fn() },
    factory: { findFirst: vi.fn() },
    process: { findFirst: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };
  mock.$transaction.mockImplementation(async (fn) => fn(mock));
  return mock;
}
