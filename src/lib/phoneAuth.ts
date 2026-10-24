export function normalizePhone(value: string): string {
  const compact = value.replace(/[\s()-]/g, '');
  const phone = /^[6-9]\d{9}$/.test(compact) ? `+91${compact}` : compact;
  if (!/^\+[1-9]\d{7,14}$/.test(phone))
    throw new Error(
      'Enter a 10-digit Indian mobile number or an international number with country code.',
    );
  if (phone.startsWith('+91') && !/^\+91[6-9]\d{9}$/.test(phone))
    throw new Error('Enter a valid 10-digit Indian mobile number.');
  return phone;
}

export function phoneAuthError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  const messages: Record<string, string> = {
    'auth/invalid-phone-number': 'Check your mobile number and country code.',
    'auth/invalid-verification-code': 'That OTP is incorrect. Check the SMS and try again.',
    'auth/code-expired': 'This OTP has expired. Request a new code.',
    'auth/session-expired': 'This verification session has expired. Request a new code.',
    'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
    'auth/quota-exceeded':
      'SMS is temporarily unavailable. Check the Firebase SMS quota and billing.',
    'auth/billing-not-enabled': 'SMS sign-in requires billing to be enabled in Firebase.',
    'auth/operation-not-allowed':
      'Enable Phone sign-in and allow the destination region in Firebase Authentication.',
    'auth/unauthorized-domain':
      'Add this website domain to Firebase Authentication authorized domains.',
    'auth/captcha-check-failed':
      'Security verification failed or expired. Complete reCAPTCHA and try again.',
    'auth/invalid-app-credential':
      'Security verification failed. Check the authorized domain and Firebase phone-auth setup.',
    'auth/network-request-failed': 'Check your internet connection and try again.',
  };
  if (code && messages[code]) return messages[code];
  const safeCode = code && /^auth\/[a-z-]+$/.test(code) ? ` (${code})` : '';
  return `Unable to complete phone sign-in${safeCode}. Try again or check Firebase Authentication setup.`;
}
