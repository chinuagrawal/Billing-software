import {
  ArrowUpRight,
  ArrowRight,
  Check,
  FileText,
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
  return (
    <div className="public-site">
      <header className="public-nav">
        <a href="#home" onClick={() => onNavigate(false)} className="public-brand">
          <span>ae.</span> Agrawal Billing
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
            <span className="public-eyebrow">YOUR BUSINESS. IN BALANCE.</span>
            <h1>
              Welcome back.
              <br />
              <em>Let’s get to work.</em>
            </h1>
            <p>
              Your customers, invoices and stock.
              <br />
              One familiar place to pick up where you left off.
            </p>
            <div className="login-story-note">
              <FileText size={24} />
              <div>
                <strong>From first bill to daily business.</strong>
                <p>Built for B2B and B2C billing in India.</p>
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
                <i /> MADE FOR EVERYDAY BUSINESS
              </span>
              <h1>
                Less paperwork.
                <br />
                More <em>possibility.</em>
              </h1>
              <p>
                Beautiful GST bills. Clear stock records. A better view of your business. Bring your
                wholesale and retail billing together in one simple workspace.
              </p>
              <div className="hero-actions">
                <button className="public-primary" onClick={() => onNavigate(true)}>
                  Start your workspace <ArrowUpRight size={19} />
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
                <span>YOUR NEXT GOOD DAY</span>
                <span>✦</span>
              </div>
              <div className="preview-invoice">
                <div className="preview-heading">
                  <span className="preview-logo">ae.</span>
                  <div>
                    <strong>TAX INVOICE</strong>
                    <small>AE/26-27/0001</small>
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
                <div className="preview-footer">A little less admin. A little more time.</div>
              </div>
              <div className="preview-float">
                <span>
                  <Check size={19} />
                </span>
                <div>
                  <strong>Ready to share</strong>
                  <small>Your bill, beautifully presented.</small>
                </div>
              </div>
              <small className="preview-caption">Illustrative sample invoice</small>
            </div>
          </section>
          <div className="public-strip">
            <span>ONE WORKSPACE, FROM SALE TO SUMMARY</span>
            <strong>Invoice.</strong>
            <strong>Track.</strong>
            <strong>Understand.</strong>
          </div>
          <section className="public-features" id="features">
            <div className="features-heading">
              <span className="public-eyebrow">LESS FRICTION. MORE CLARITY.</span>
              <h2>
                The everyday essentials.
                <br />
                <em>Thoughtfully together.</em>
              </h2>
            </div>
            <div className="feature-grid">
              {[
                {
                  icon: FileText,
                  title: 'Bills that mean business.',
                  text: 'Create GST invoices, enter prices including tax, choose your bill style and save or share a PDF.',
                },
                {
                  icon: Package,
                  title: 'Know what’s in stock.',
                  text: 'Manage products, record purchases and track stock costs as your purchase prices change.',
                },
                {
                  icon: BarChart3,
                  title: 'See the bigger picture.',
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
              <span className="public-eyebrow">MAKE ROOM FOR YOUR BUSINESS</span>
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
          <span>ae.</span> Agrawal Billing
        </a>
        <span>Built for business in India.</span>
        <button onClick={() => onNavigate(true)}>
          Your workspace <ArrowUpRight size={14} />
        </button>
      </footer>
    </div>
  );
}
