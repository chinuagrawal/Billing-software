import { useEffect } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  FileText,
  Layers2,
  ShieldCheck,
  Package,
  BarChart3,
  ArrowLeft,
} from 'lucide-react';
import { AuthForm } from './Settings';
import './landing.css';

export function Landing({
  login,
  onNavigate,
  onDemo,
}: {
  login: boolean;
  onNavigate: (login: boolean) => void;
  onDemo: () => void;
}) {
  useEffect(() => {
    if (location.hash !== '#features') window.scrollTo(0, 0);
  }, [login]);

  return (
    <div className="public-site">
      <header className="public-nav">
        <a href="#home" onClick={() => onNavigate(false)} className="public-brand">
          <span className="public-mark">
            <Layers2 size={19} aria-hidden="true" />
          </span>{' '}
          Billora
        </a>
        <nav aria-label="Main navigation">
          {!login && <a href="#features">Features</a>}
          <button onClick={() => onNavigate(true)}>
            Sign in <ArrowUpRight size={16} />
          </button>
        </nav>
      </header>
      {login ? (
        <main className="public-login">
          <section className="login-story">
            <span className="public-eyebrow">BILLORA WORKSPACE</span>
            <h1>
              Welcome back.
              <br />
              <em>Sign in to Billora.</em>
            </h1>
            <p>Access your invoices, inventory and payments from your workspace.</p>
            <div className="login-story-note">
              <ShieldCheck size={24} />
              <div>
                <strong>Sign in with your mobile</strong>
                <p>Use the number linked to your workspace.</p>
              </div>
            </div>
            <button className="public-back" onClick={() => onNavigate(false)}>
              <ArrowLeft size={17} /> Back to home
            </button>
          </section>
          <section className="public-auth" aria-label="Sign in">
            <AuthForm onDone={() => onNavigate(false)} />
          </section>
        </main>
      ) : (
        <main>
          <section className="public-hero">
            <div className="hero-copy">
              <span className="public-eyebrow">
                <i /> GST BILLING FOR INDIAN BUSINESSES
              </span>
              <h1>
                GST billing.
                <br />
                <em>In sync.</em>
              </h1>
              <p>
                Create wholesale and retail invoices, track inventory and payments, and share GST
                reports with your accountant.
              </p>
              <div className="hero-actions">
                <button className="public-primary" onClick={() => onNavigate(true)}>
                  Open your workspace <ArrowUpRight size={19} />
                </button>
                <button className="public-demo" onClick={onDemo}>
                  Explore the demo <ArrowRight size={18} />
                </button>
              </div>
              <div className="hero-checks">
                <span>
                  <Check size={15} /> B2B & B2C
                </span>
                <span>
                  <Check size={15} /> GST-ready invoices
                </span>
                <span>
                  <Check size={15} /> PDF sharing
                </span>
              </div>
            </div>
            <div className="hero-preview" aria-label="Illustrative invoice preview">
              <div className="preview-top">
                <span>
                  <i /> Invoice preview
                </span>
                <span>Sample</span>
              </div>
              <div className="preview-invoice">
                <div className="preview-heading">
                  <span className="preview-logo">
                    <Layers2 size={20} aria-hidden="true" /> Billora
                  </span>
                  <div>
                    <strong>TAX INVOICE</strong>
                    <small>INV/26-27/0001</small>
                  </div>
                </div>
                <div className="preview-parties">
                  <div>
                    <small>BILLED TO</small>
                    <strong>Mehta General Store</strong>
                    <span>Jaipur, Rajasthan</span>
                  </div>
                  <span className="preview-pill">B2B</span>
                </div>
                <div className="preview-row preview-label">
                  <span>ITEM</span>
                  <span>AMOUNT</span>
                </div>
                <div className="preview-row">
                  <span>
                    Cotton tote bags <small>20 PCS × ₹150</small>
                  </span>
                  <strong>₹3,000.00</strong>
                </div>
                <div className="preview-row">
                  <span>
                    Gift boxes <small>10 PCS × ₹100</small>
                  </span>
                  <strong>₹1,000.00</strong>
                </div>
                <div className="preview-tax">
                  <span>
                    Taxable value <b>₹4,000.00</b>
                  </span>
                  <span>
                    GST · 18% <b>₹720.00</b>
                  </span>
                </div>
                <div className="preview-total">
                  <span>Invoice total</span>
                  <strong>₹4,720.00</strong>
                </div>
              </div>
              <div className="preview-float">
                <span>
                  <Check size={19} />
                </span>
                <div>
                  <strong>Ready to share</strong>
                  <small>PDF invoice</small>
                </div>
              </div>
            </div>
          </section>
          <section className="public-features" id="features">
            <div className="features-heading">
              <span className="public-eyebrow">THE BILLORA WORKSPACE</span>
              <h2>
                From the first invoice
                <br />
                <em>to month-end.</em>
              </h2>
            </div>
            <div className="feature-grid">
              {[
                {
                  icon: FileText,
                  title: 'GST invoices',
                  text: 'Create GST invoices, enter prices including tax, choose your bill style and save or share a PDF.',
                },
                {
                  icon: Package,
                  title: 'Inventory and purchases',
                  text: 'Manage products, record purchases and track stock costs as your purchase prices change.',
                },
                {
                  icon: BarChart3,
                  title: 'Payments and reports',
                  text: 'Follow payments and invoice profit, then prepare GSTR-1 Excel reports for your accountant.',
                },
              ].map(({ icon: Icon, title, text }) => (
                <article key={title}>
                  <Icon size={25} strokeWidth={1.5} />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="public-cta">
            <div>
              <h2>Your next invoice starts here.</h2>
            </div>
            <button className="public-primary" onClick={() => onNavigate(true)}>
              Get started <ArrowUpRight size={19} />
            </button>
          </section>
        </main>
      )}
      <footer className="public-footer">
        <a className="public-brand" href="#home" onClick={() => onNavigate(false)}>
          <span className="public-mark">
            <Layers2 size={19} aria-hidden="true" />
          </span>{' '}
          Billora
        </a>
        <span>Built for business in India.</span>
        <button onClick={() => onNavigate(true)}>
          Your workspace <ArrowUpRight size={14} />
        </button>
      </footer>
    </div>
  );
}
