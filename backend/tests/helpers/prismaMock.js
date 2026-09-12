import { vi } from 'vitest';

/** In-memory stand-in for the Prisma client; tests configure return values per case. */
export function createPrismaMock() {
  const mock = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    organization: { create: vi.fn() },
    factory: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    process: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    activity: {
      create: vi.fn(),
      createMany: vi.fn(),
      createManyAndReturn: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    emissionFactor: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    emission: { create: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };
  mock.$transaction.mockImplementation(async (fn) => fn(mock));
  return mock;
}
