import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

export async function deleteOwnerAccount(database: Firestore, auth: Auth, uid: string) {
  if (!uid || uid.includes('/')) throw new Error('Invalid account identity.');
  // A durable, server-only tombstone prevents transactions already in flight from
  // recreating records during or after recursive cleanup. Retries resume cleanup.
  const lifecycle = database.collection('accountLifecycle').doc(uid);
  await database.runTransaction(async (tx) => {
    const existing = await tx.get(lifecycle);
    if (!existing.exists)
      tx.create(lifecycle, { status: 'deleting', startedAt: new Date().toISOString() });
  });
  await database.recursiveDelete(database.collection('workspaces').doc(uid));
  await auth.deleteUser(uid);
}
