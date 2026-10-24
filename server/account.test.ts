import { describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { deleteOwnerAccount } from './account';

function fixture(failCleanup = false) {
  const order: string[] = [];
  const reference = (path: string) => ({ path });
  const recursiveDelete = vi.fn(async (ref: { path: string }) => {
    order.push(ref.path);
    if (failCleanup) throw new Error('Cleanup failed');
  });
  const database = {
    collection: (name: string) => ({ doc: (uid: string) => reference(`${name}/${uid}`) }),
    runTransaction: async (work: (tx: unknown) => unknown) =>
      work({
        get: async () => ({ exists: false }),
        create: (ref: { path: string }) => order.push(ref.path),
      }),
    recursiveDelete,
  } as unknown as Firestore;
  const remove = vi.fn(async (uid: string) => {
    order.push(`auth/${uid}`);
  });
  return {
    database,
    auth: { deleteUser: remove } as unknown as Auth,
    remove,
    recursiveDelete,
    order,
  };
}
describe('account cleanup', () => {
  it('locks writes, removes only the owner subtree, then deletes their sign-in', async () => {
    const f = fixture();
    await deleteOwnerAccount(f.database, f.auth, 'owner');
    expect(f.order).toEqual(['accountLifecycle/owner', 'workspaces/owner', 'auth/owner']);
  });
  it('preserves sign-in when cleanup fails so the owner can retry', async () => {
    const f = fixture(true);
    await expect(deleteOwnerAccount(f.database, f.auth, 'owner')).rejects.toThrow('Cleanup failed');
    expect(f.remove).not.toHaveBeenCalled();
  });
  it('rejects invalid owner paths before any deletion', async () => {
    const f = fixture();
    await expect(deleteOwnerAccount(f.database, f.auth, '../victim')).rejects.toThrow();
    expect(f.recursiveDelete).not.toHaveBeenCalled();
  });
});
