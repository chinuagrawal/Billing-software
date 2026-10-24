import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyWorkspace } from '../lib/seed';
const context = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('../lib/store', () => ({ useStore: () => context.current }));
import App from '../App';

beforeEach(() => {
  vi.stubGlobal('location', { hash: '' });
  context.current = {
    data: emptyWorkspace(),
    mode: 'cloud',
    user: { uid: 'owner', phoneNumber: '+919876543210' },
    loading: false,
    error: '',
    logout: vi.fn(),
    execute: vi.fn(),
    resetDemo: vi.fn(),
  };
});
describe('first sign-in screen', () => {
  it('requires setup before showing the billing workspace', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Set up your business');
    expect(html).toContain('Save details &amp; open workspace');
    expect(html).not.toContain('Business overview');
    expect(html).not.toContain('value="Agrawal Enterprises"');
    expect(html).not.toContain('value="AE"');
    expect(html).toContain('Select a state');
    expect(html).toContain('value="+919876543210"');
    expect(html).toContain('Delete account');
  });
  it('keeps the workspace open after profile completion', () => {
    const data = emptyWorkspace();
    data.business.setupCompleted = true;
    context.current.data = data;
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Business overview');
    expect(html).not.toContain('Save details &amp; open workspace');
  });
  it('preserves the separate demo experience', () => {
    context.current.mode = 'demo';
    context.current.user = null;
    expect(renderToStaticMarkup(<App />)).toContain('Business overview');
  });
});
