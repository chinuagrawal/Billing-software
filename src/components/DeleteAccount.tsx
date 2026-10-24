import { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Trash2, ShieldCheck } from 'lucide-react';
import { useStore } from '../lib/store';
import { download, today } from '../lib/billing';
import { PhoneSignIn } from './PhoneSignIn';
import { Field, Modal } from './ui';

export function DeleteAccount() {
  const { user, data, logout } = useStore();
  const [open, setOpen] = useState(false);
  const [verified, setVerified] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!user) return null;
  const close = () => {
    if (!busy) {
      setOpen(false);
      setVerified(false);
      setConfirmation('');
      setError('');
      setPassword('');
    }
  };
  async function remove() {
    if (!user || confirmation !== 'DELETE' || busy || !verified) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user.getIdToken(true)}`,
        },
        body: JSON.stringify({ confirmation }),
      });
      const result = await response
        .json()
        .catch(() => ({ error: 'Account service unavailable. Try again.' }));
      if (!response.ok || !result.ok) {
        if (result.code === 'REAUTH_REQUIRED') setVerified(false);
        throw new Error(result.error || 'Account deletion failed.');
      }
      await logout();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel backup-card account-danger">
        <h3>Delete account</h3>
        <p>Permanently delete your sign-in account and all billing records in this workspace.</p>
        <button className="button danger full-width" onClick={() => setOpen(true)}>
          <Trash2 size={16} />
          Delete account
        </button>
      </section>
      {open && (
        <Modal title="Permanently delete your account" onClose={close}>
          <div className="form-body">
            <div className="error-banner">
              This permanently removes your account, business profile, invoices, customers,
              inventory, payments and activity history. It cannot be undone. Download your records
              before continuing.
            </div>
            <button
              className="button secondary full-width"
              onClick={() =>
                download(
                  `billing-backup-${today()}.json`,
                  JSON.stringify(data, null, 2),
                  'application/json',
                )
              }
            >
              Download backup first
            </button>
          </div>
          {!verified ? (
            user.phoneNumber ? (
              <PhoneSignIn
                reauthenticate={user}
                onDone={() => {
                  setVerified(true);
                  setError('');
                }}
              />
            ) : (
              <form
                className="form-body"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError('');
                  try {
                    if (!user.email) throw new Error('Sign in again to verify your identity.');
                    await reauthenticateWithCredential(
                      user,
                      EmailAuthProvider.credential(user.email, password),
                    );
                    setVerified(true);
                    setPassword('');
                  } catch {
                    setError('Could not verify your password. Please try again.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <p>Confirm your password for {user.email}.</p>
                <Field label="Current password">
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                <button className="button secondary full-width" disabled={busy}>
                  Verify identity
                </button>
              </form>
            )
          ) : (
            <form
              className="form-body"
              onSubmit={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              <p className="info-banner">
                <ShieldCheck size={16} /> Identity verified. Type DELETE to confirm.
              </p>
              <Field label="Type DELETE">
                <input
                  autoComplete="off"
                  value={confirmation}
                  disabled={busy}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </Field>
              <button
                className="button danger full-width"
                disabled={busy || confirmation !== 'DELETE'}
              >
                {busy ? 'Deleting account…' : 'Permanently delete account and records'}
              </button>
            </form>
          )}
          <div className="form-body">
            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
            <button className="button secondary full-width" disabled={busy} onClick={close}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
