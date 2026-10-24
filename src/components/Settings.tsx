import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  Building2,
  Cloud,
  CreditCard,
  Download,
  Save,
  ShieldCheck,
  LogOut,
  RotateCcw,
  ArrowRight,
  LockKeyhole,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { auth, firebaseConfigured, missingFirebaseConfig } from '../lib/firebase';
import { download, today, businessSetupError } from '../lib/billing';
import { DeleteAccount } from './DeleteAccount';
import { InvoiceStylePicker } from './InvoiceStylePicker';
import { resolveTemplate } from '../lib/invoiceTemplates';
import { Field, SectionTitle, StateSelect } from './ui';
import { PhoneSignIn } from './PhoneSignIn';
import type { Business } from '../types';

export function Settings({
  notify,
  onConnect,
  onboarding = false,
}: {
  notify: (s: string) => void;
  onConnect: () => void;
  onboarding?: boolean;
}) {
  const { data, execute, mode, user, logout, resetDemo } = useStore();
  const [b, setB] = useState(() => ({
      ...data.business,
      phone: data.business.phone || user?.phoneNumber || '',
      email: data.business.email || user?.email || '',
    })),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState(false);
  const set = (key: keyof Business, value: string) => setB({ ...b, [key]: value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const business = { ...b, setupCompleted: onboarding || Boolean(b.setupCompleted) };
      if (business.setupCompleted) {
        const problem = businessSetupError(business);
        if (problem) throw new Error(problem);
      }
      await execute({ type: 'saveBusiness', business });
      notify('Business settings saved. New invoices will use these details.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionTitle
        title={onboarding ? 'Set up your business' : 'Business settings'}
        subtitle={
          onboarding
            ? 'Enter your real account details to open your billing workspace.'
            : 'Make this workspace feel like your business.'
        }
      />
      <div className="settings-layout">
        <form onSubmit={save}>
          <section className="panel settings-panel">
            <div className="panel-header">
              <div className="settings-title">
                <Building2 size={20} />
                <div>
                  <h3>Business profile</h3>
                  <p>Your details appear on new invoices</p>
                </div>
              </div>
              <span className="tiny-tag">INDIA · INR</span>
            </div>
            <div className="form-body">
              <div className="form-grid">
                <Field label="Registered business name *">
                  <input required value={b.name} onChange={(e) => set('name', e.target.value)} />
                </Field>
                <Field
                  label={onboarding || b.setupCompleted ? 'GSTIN *' : 'GSTIN'}
                  hint="Required before issuing GST tax invoices."
                >
                  <input
                    required={onboarding || b.setupCompleted}
                    maxLength={15}
                    value={b.gstin}
                    placeholder="08XXXXXXXXXX1ZX"
                    onChange={(e) => set('gstin', e.target.value.toUpperCase())}
                  />
                </Field>
                <Field label="Home state *">
                  <StateSelect value={b.state} onChange={(v) => set('state', v)} />
                </Field>
                <Field label="Invoice prefix *" hint="Example: AE/26-27/0001">
                  <input
                    required
                    maxLength={5}
                    value={b.prefix}
                    onChange={(e) => set('prefix', e.target.value.toUpperCase())}
                  />
                </Field>
                <Field
                  label={onboarding || b.setupCompleted ? 'Business email *' : 'Business email'}
                >
                  <input
                    required={onboarding || b.setupCompleted}
                    type="email"
                    value={b.email}
                    onChange={(e) => set('email', e.target.value)}
                  />
                </Field>
                <Field label={onboarding || b.setupCompleted ? 'Phone *' : 'Phone'}>
                  <input
                    required={onboarding || b.setupCompleted}
                    type="tel"
                    value={b.phone}
                    onChange={(e) => set('phone', e.target.value)}
                  />
                </Field>
              </div>
              <Field
                label={
                  onboarding || b.setupCompleted ? 'Registered address *' : 'Registered address'
                }
              >
                <textarea
                  required={onboarding || b.setupCompleted}
                  rows={3}
                  value={b.address}
                  onChange={(e) => set('address', e.target.value)}
                  placeholder="Street, city, state and PIN code"
                />
              </Field>
            </div>
          </section>
          <section className="panel settings-panel">
            <div className="panel-header">
              <div className="settings-title">
                <CreditCard size={20} />
                <div>
                  <h3>Payment details</h3>
                  <p>Optional: add bank or UPI instructions for your invoices</p>
                </div>
              </div>
            </div>
            <div className="form-body">
              <div className="form-grid">
                <Field label="Bank name">
                  <input value={b.bankName} onChange={(e) => set('bankName', e.target.value)} />
                </Field>
                <Field label="Account number">
                  <input value={b.account} onChange={(e) => set('account', e.target.value)} />
                </Field>
                <Field label="IFSC code">
                  <input
                    value={b.ifsc}
                    onChange={(e) => set('ifsc', e.target.value.toUpperCase())}
                  />
                </Field>
                <Field label="UPI ID">
                  <input
                    value={b.upi}
                    placeholder="yourbusiness@bank"
                    onChange={(e) => set('upi', e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Invoice terms">
                <textarea rows={3} value={b.terms} onChange={(e) => set('terms', e.target.value)} />
              </Field>
            </div>
          </section>
          <InvoiceStylePicker
            value={resolveTemplate(b.invoiceTemplate)}
            onChange={(invoiceTemplate) => setB({ ...b, invoiceTemplate })}
            business={b}
          />
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          <div className="settings-save">
            <p>Issued invoices keep the business details they were created with.</p>
            <button className="button primary" disabled={busy}>
              <Save size={16} />
              {busy ? 'Saving…' : onboarding ? 'Save details & open workspace' : 'Save changes'}
            </button>
          </div>
        </form>
        <aside>
          <section className="panel connection-card">
            <span className="connection-icon">
              <Cloud size={27} />
            </span>
            <h3>{mode === 'cloud' ? 'Your business, connected.' : 'Your business, everywhere.'}</h3>
            <p>
              {mode === 'cloud'
                ? `Signed in as ${user?.phoneNumber || user?.email || 'your account'}. Your records are stored in your private Firebase workspace.`
                : 'Connect your cloud workspace to access your invoices, customers and inventory across devices.'}
            </p>
            <div className="connection-status">
              <span className={`live-dot ${mode === 'demo' ? 'amber' : ''}`} />
              {mode === 'cloud' ? 'Firebase connected' : 'Demo workspace · this device'}
            </div>
            {mode === 'cloud' ? (
              <button className="button secondary full-width" onClick={() => void logout()}>
                <LogOut size={16} />
                Sign out
              </button>
            ) : (
              <button className="button primary full-width" onClick={onConnect}>
                Connect workspace
                <ArrowRight size={16} />
              </button>
            )}
            <small>
              <ShieldCheck size={14} />
              Your account. Your business data.
            </small>
          </section>
          <section className="panel backup-card">
            <h3>Keep a copy</h3>
            <p>Download your complete workspace as a JSON backup for safekeeping.</p>
            <button
              className="button secondary full-width"
              onClick={() => {
                download(
                  `agrawal-backup-${today()}.json`,
                  JSON.stringify(data, null, 2),
                  'application/json',
                );
                notify('Workspace backup downloaded.');
              }}
            >
              <Download size={16} />
              Download backup
            </button>
          </section>
          {mode === 'cloud' && <DeleteAccount />}
          {mode === 'demo' && (
            <section className="panel backup-card">
              <h3>Explore from a fresh start</h3>
              <p>Restore sample data in this demo workspace.</p>
              {confirm ? (
                <>
                  <p>This replaces your local demo changes. Download a backup first if needed.</p>
                  <div className="row-actions">
                    <button className="button secondary" onClick={() => setConfirm(false)}>
                      Cancel
                    </button>
                    <button
                      className="button danger"
                      onClick={() => {
                        resetDemo();
                        setConfirm(false);
                        notify('Demo workspace reset.');
                      }}
                    >
                      Reset demo
                    </button>
                  </div>
                </>
              ) : (
                <button className="button secondary full-width" onClick={() => setConfirm(true)}>
                  <RotateCcw size={15} />
                  Reset demo data
                </button>
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
export function AuthForm({ onDone }: { onDone: () => void }) {
  const [emailMode, setEmailMode] = useState(false);
  if (!firebaseConfigured) return <EmailAuthForm onDone={onDone} />;
  return (
    <>
      {emailMode ? <EmailAuthForm onDone={onDone} /> : <PhoneSignIn onDone={onDone} />}
      <div className="auth-links auth-method-switch">
        <button type="button" onClick={() => setEmailMode(!emailMode)}>
          {emailMode ? 'Use mobile OTP instead' : 'Use an existing email account instead'}
        </button>
      </div>
    </>
  );
}
function EmailAuthForm({ onDone }: { onDone: () => void }) {
  const [register, setRegister] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  if (!firebaseConfigured)
    return (
      <div className="form-body cloud-setup">
        <span className="connection-icon">
          <Cloud size={28} />
        </span>
        <h3>Your cloud workspace is ready to connect</h3>
        <div className="error-banner" role="alert">
          This build is missing: {missingFirebaseConfig.join(', ')}. Add these exact names to
          Vercel's Production environment and redeploy. Server-only FIREBASE_* values do not replace
          the VITE_FIREBASE_* browser configuration.
        </div>
        <p>
          Add your Firebase web app configuration to the project’s environment settings, enable
          Phone sign-in, and deploy the included Firestore rules.
        </p>
        <ol>
          <li>Create a Firebase project and register a web app.</li>
          <li>
            Copy its web configuration into <code>.env.local</code> using <code>.env.example</code>.
          </li>
          <li>Enable Authentication and Cloud Firestore.</li>
          <li>Add the server-only Firebase credentials from the setup guide.</li>
          <li>Deploy the Firestore rules, then restart the app.</li>
          <li>Add the same environment variables to Vercel.</li>
        </ol>
        <p className="info-banner">
          The setup guide is included in the project README. Until connected, demo changes stay in
          this browser.
        </p>
        <button className="button primary full-width" onClick={onDone}>
          Continue exploring demo
        </button>
      </div>
    );
  return (
    <form
      className="form-body"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!auth) return;
        setError('');
        setBusy(true);
        try {
          if (register) await createUserWithEmailAndPassword(auth, email, password);
          else await signInWithEmailAndPassword(auth, email, password);
          onDone();
        } catch (e) {
          const code = (e as { code?: string }).code;
          setError(
            code === 'auth/invalid-credential'
              ? 'Email or password is incorrect.'
              : code === 'auth/email-already-in-use'
                ? 'An account already exists for this email. Sign in instead.'
                : code === 'auth/weak-password'
                  ? 'Choose a stronger password.'
                  : code === 'auth/too-many-requests'
                    ? 'Too many attempts. Please try again later.'
                    : 'Unable to sign in. Check your connection and Firebase authentication setup.',
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="auth-intro">
        <span className="connection-icon">
          <LockKeyhole size={26} />
        </span>
        <h3>{register ? 'A fresh start for your business' : 'Welcome back'}</h3>
        <p>
          {register
            ? 'Your new cloud workspace starts empty.'
            : 'Sign in to access your private business workspace.'}
        </p>
      </div>
      <Field label="Email address">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Password">
        <input
          type="password"
          required
          minLength={8}
          autoComplete={register ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {message && <div className="info-banner">{message}</div>}
      <button className="button primary full-width" disabled={busy}>
        {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
      </button>
      <div className="auth-links">
        <button type="button" onClick={() => setRegister(!register)}>
          {register ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
        {!register && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!email) {
                setError('Enter your email address first.');
                return;
              }
              if (!auth) return;
              try {
                await sendPasswordResetEmail(auth, email);
                setMessage('If an account exists, a password reset email will arrive shortly.');
                setError('');
              } catch {
                setError('Could not send reset email. Check the address and try again.');
              }
            }}
          >
            Forgot password?
          </button>
        )}
      </div>
    </form>
  );
}
