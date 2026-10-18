import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { executeServerCommand } from './commands';
import { emptyWorkspace } from '../src/lib/seed';
import type { Command, Product } from '../src/types';

function databaseFixture() {
  const records = new Map<string, unknown>();
  const ref = (path: string): unknown => ({
    path,
    collection: (name: string) => ({ doc: (id: string) => ref(`${path}/${name}/${id}`) }),
  });
  const database = {
    collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
    runTransaction: async (work: (transaction: unknown) => Promise<unknown>) => {
      const staged = new Map(records);
      const transaction = {
        get: async (reference: { path: string }) => ({
          exists: records.has(reference.path),
          data: () => structuredClone(records.get(reference.path)),
        }),
        set: (reference: { path: string }, value: unknown) =>
          staged.set(reference.path, structuredClone(value)),
        create: (reference: { path: string }, value: unknown) => {
          if (records.has(reference.path)) throw new Error('Already exists');
          staged.set(reference.path, structuredClone(value));
        },
      };
      const result = await work(transaction);
      records.clear();
      for (const [key, value] of staged) records.set(key, value);
      return result;
    },
  } as unknown as Firestore;
  return { database, records };
}
const product: Product = {
  id: 'p1',
  name: 'Tote',
  sku: 'TOTE-1',
  category: 'Bags',
  hsn: '420222',
  price: 500,
  cost: 200,
  gst: 18,
  stock: 10,
  lowStock: 2,
  unit: 'PCS',
  color: 'sage',
};
describe('trusted server commands', () => {
  it('writes only within the verified owner workspace', async () => {
    const { database, records } = databaseFixture();
    await executeServerCommand(database, 'verified-owner', 'request-1', {
      type: 'saveProduct',
      product,
    });
    expect(records.get('workspaces/verified-owner/products/p1')).toEqual(product);
    expect([...records.keys()].every((key) => key.startsWith('workspaces/verified-owner/'))).toBe(
      true,
    );
  });
  it('replays the same stock request without applying it twice', async () => {
    const { database, records } = databaseFixture();
    records.set('workspaces/owner/products/p1', product);
    const command: Command = { type: 'stock', id: 'p1', quantity: 5, reason: 'Purchase received' };
    expect(await executeServerCommand(database, 'owner', 'same-request', command)).toEqual({
      replayed: false,
    });
    expect(await executeServerCommand(database, 'owner', 'same-request', command)).toEqual({
      replayed: true,
    });
    expect((records.get('workspaces/owner/products/p1') as Product).stock).toBe(15);
    expect([...records.keys()].filter((key) => key.includes('/audit/'))).toHaveLength(1);
  });
  it('rejects reusing a request ID with different content', async () => {
    const { database } = databaseFixture();
    await executeServerCommand(database, 'owner', 'request-1', { type: 'saveProduct', product });
    await expect(
      executeServerCommand(database, 'owner', 'request-1', {
        type: 'saveProduct',
        product: { ...product, name: 'Different' },
      }),
    ).rejects.toThrow('different change');
  });
  it('reserves case-insensitive SKUs across product creations', async () => {
    const { database } = databaseFixture();
    await executeServerCommand(database, 'owner', 'request-1', { type: 'saveProduct', product });
    await expect(
      executeServerCommand(database, 'owner', 'request-2', {
        type: 'saveProduct',
        product: { ...product, id: 'p2', sku: 'tote-1' },
      }),
    ).rejects.toThrow('SKU');
  });
  it('commits no records when business validation fails', async () => {
    const { database, records } = databaseFixture();
    records.set('workspaces/owner/products/p1', product);
    await expect(
      executeServerCommand(database, 'owner', 'request-1', {
        type: 'stock',
        id: 'p1',
        quantity: -20,
        reason: 'Invalid',
      }),
    ).rejects.toThrow();
    expect(records.size).toBe(1);
    expect((records.get('workspaces/owner/products/p1') as Product).stock).toBe(10);
  });
  it('creates initial business settings even when they equal the default', async () => {
    const { database, records } = databaseFixture();
    const business = emptyWorkspace().business;
    await executeServerCommand(database, 'owner', 'request-1', { type: 'saveBusiness', business });
    expect(records.get('workspaces/owner/settings/business')).toEqual(business);
  });
});
