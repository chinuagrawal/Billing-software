import { useEffect, useRef, useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import type { ConfirmationResult } from 'firebase/auth';
import { Smartphone } from 'lucide-react';
import { auth } from '../lib/firebase';
import { normalizePhone, phoneAuthError } from '../lib/phoneAuth';
import { Field } from './ui';

export function PhoneSignIn({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [consent, setConsent] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const verifier = useRef<RecaptchaVerifier | null>(null);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      verifier.current?.clear();
      verifier.current = null;
    };
  }, []);
  useEffect(() => {
    if (!remaining) return;
    const timer = window.setTimeout(() => setRemaining((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  async function send() {
    if (!auth || !container.current || inFlight.current || remaining > 0) return;
    setError('');
    let number: string;
    try {
      number = normalizePhone(phone);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    if (!consent) {
      setError('Please agree to receive the sign-in SMS.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setConfirmation(null);
    setCode('');
    try {
      verifier.current?.clear();
      verifier.current = new RecaptchaVerifier(auth, container.current, { size: 'normal' });
      const result = await signInWithPhoneNumber(auth, number, verifier.current);
      if (mounted.current) {
        setConfirmation(result);
        setSentTo(number);
        setRemaining(60);
      }
    } catch (e) {
      if (mounted.current) setError(phoneAuthError(e));
    } finally {
      verifier.current?.clear();
      verifier.current = null;
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function verify() {
    if (!confirmation || inFlight.current) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit OTP from your SMS.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await confirmation.confirm(code);
      if (mounted.current) onDone();
    } catch (e) {
      if (mounted.current) setError(phoneAuthError(e));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <form
      className="form-body"
      onSubmit={(e) => {
        e.preventDefault();
        void (confirmation ? verify() : send());
      }}
    >
      <div className="auth-intro">
        <span className="connection-icon">
          <Smartphone size={26} />
        </span>
        <h3>Sign in with your mobile</h3>
        <p>Access your B2B and B2C billing workspace with a one-time SMS code.</p>
      </div>
      <Field
        label="Mobile number"
        hint="Indian mobile: 10 digits. Other countries: include + and country code."
      >
        <input
          type="tel"
          autoComplete="tel"
          required
          value={phone}
          disabled={busy || Boolean(confirmation)}
          placeholder="9876543210 or +919876543210"
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>
      {!confirmation && (
        <label className="phone-consent">
          <input
            type="checkbox"
            checked={consent}
            disabled={busy}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            I agree to receive a sign-in SMS. Google processes and stores this phone number for spam
            and abuse prevention. SMS charges may apply.
          </span>
        </label>
      )}
      {confirmation && (
        <>
          <p className="info-banner" role="status">
            OTP sent to {sentTo}. Enter it below to sign in.
          </p>
          <Field label="6-digit OTP">
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              disabled={busy}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </Field>
        </>
      )}
      <div ref={container} className="phone-recaptcha" />
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <button
        className="button primary full-width"
        disabled={busy || (!confirmation && (!consent || remaining > 0))}
      >
        {busy
          ? 'Please wait…'
          : confirmation
            ? 'Verify OTP & sign in'
            : remaining > 0
              ? `Send OTP in ${remaining}s`
              : 'Send OTP'}
      </button>
      {confirmation && (
        <div className="auth-links">
          <button type="button" disabled={busy || remaining > 0} onClick={() => void send()}>
            {remaining ? `Resend in ${remaining}s` : 'Resend OTP'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirmation(null);
              setCode('');
              setError('');
            }}
          >
            Change mobile number
          </button>
        </div>
      )}
      <p className="form-hint">
        First sign-in creates an empty workspace. Always use the same sign-in method to access your
        existing records.
      </p>
    </form>
  );
}
