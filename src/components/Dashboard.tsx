import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileText,
  Plus,
  ArrowRight,
  Package,
  ShoppingBag,
  Store,
  Globe,
  CircleCheck,
} from 'lucide-react';
import { useStore } from '../lib/store';
import {
  money,
  compactMoney,
  invoiceTotals,
  balance,
  status,
  dateLabel,
  today,
} from '../lib/billing';
import { Avatar, Badge, Empty, MiniLink, ProductIcon, SectionTitle } from './ui';
import type { Invoice } from '../types';

export function Dashboard({
  navigate,
  newInvoice,
  viewInvoice,
}: {
  navigate: (page: string) => void;
  newInvoice: () => void;
  viewInvoice: (i: Invoice) => void;
}) {
  const { data, mode } = useStore();
  const [range, setRange] = useState('30');
  const start = new Date(`${today()}T00:00:00`);
  start.setDate(start.getDate() - Number(range) + 1);
  const startDate = start.toLocaleDateString('en-CA');
  const invoices = data.invoices.filter((i) => i.status === 'issued' && i.date >= startDate),
    revenue = invoices.reduce((a, i) => a + invoiceTotals(i).total, 0),
    collected = data.payments.filter((p) => p.date >= startDate).reduce((a, p) => a + p.amount, 0),
    outstanding = data.invoices.reduce((a, i) => a + balance(i), 0),
    overdue = data.invoices.filter((i) => status(i) === 'Overdue');
  const lowStock = data.products.filter((p) => p.stock <= p.lowStock);
  const bucketCount = Math.min(12, Number(range));
  const days = Array.from({ length: bucketCount }, (_, n) => {
    const from = new Date(start);
    from.setDate(from.getDate() + Math.floor((n * Number(range)) / bucketCount));
    const to = new Date(start);
    to.setDate(to.getDate() + Math.floor(((n + 1) * Number(range)) / bucketCount));
    const f = from.toLocaleDateString('en-CA'),
      t = to.toLocaleDateString('en-CA');
    return {
      label: from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      value: invoices
        .filter((i) => i.date >= f && i.date < t)
        .reduce((s, i) => s + invoiceTotals(i).total, 0),
    };
  });
  const max = Math.max(...days.map((d) => d.value), 1),
    points = days
      .map((d, n) => `${(n * 660) / (days.length - 1)},${175 - (d.value / max) * 175}`)
      .join(' ');
  const b2b = invoices
      .filter((i) => i.customer.type === 'B2B')
      .reduce((s, i) => s + invoiceTotals(i).total, 0),
    b2bPct = revenue ? Math.round((b2b / revenue) * 100) : 0;
  return (
    <>
      <SectionTitle
        title="Business overview"
        subtitle="A little clarity. A lot of possibilities. Here’s how you’re doing."
        action={
          <>
            <label className="date-select">
              <CalendarDays size={16} />
              <select
                aria-label="Dashboard date range"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="30">Last 30 days</option>
                <option value="7">Last 7 days</option>
                <option value="90">Last 90 days</option>
              </select>
              <ChevronDown size={14} />
            </label>
            <button className="button primary" onClick={newInvoice}>
              <Plus size={17} />
              Create invoice
            </button>
          </>
        }
      />
      {mode === 'demo' && (
        <div className="demo-banner">
          <span>
            <span className="live-dot" />
            You’re exploring your demo workspace{' '}
            <span className="demo-detail">· Sample data, real possibilities</span>
          </span>
          <button onClick={() => navigate('Settings')}>
            Set up your business <ArrowRight size={14} />
          </button>
        </div>
      )}
      <div className="stats-grid">
        {[
          {
            label: 'Total sales',
            value: money(revenue),
            icon: <CircleDollarSign size={19} />,
            detail: `${invoices.length} invoices in this period`,
            cls: 'green',
          },
          {
            label: 'Payments received',
            value: money(collected),
            icon: <ArrowDownLeft size={19} />,
            detail: 'Payments recorded in this period',
            cls: 'blue',
          },
          {
            label: 'Outstanding',
            value: money(outstanding),
            icon: <Clock3 size={19} />,
            detail: `${data.invoices.filter((i) => balance(i) > 0).length} invoices awaiting payment`,
            cls: 'orange',
          },
          {
            label: 'Overdue invoices',
            value: money(overdue.reduce((a, i) => a + balance(i), 0)),
            icon: <FileText size={19} />,
            detail: `${overdue.length} invoices need your attention`,
            cls: 'red',
          },
        ].map((s) => (
          <div className={`stat-card ${s.cls}`} key={s.label}>
            <div className="stat-top">
              <span>{s.label}</span>
              <span className="stat-icon">{s.icon}</span>
            </div>
            <h2>{s.value}</h2>
            <div className="stat-bottom">
              <small>{s.detail}</small>
              <span className="stat-currency">INR</span>
            </div>
          </div>
        ))}
      </div>
      <div className="analytics-grid">
        <section className="panel revenue-panel">
          <div className="panel-header">
            <div>
              <h3>Sales overview</h3>
              <p>A clearer picture of your business growth</p>
            </div>
            <span className="legend">
              <i />
              Gross sales
            </span>
          </div>
          <div className="revenue-total">
            {money(revenue)}
            <span>including GST</span>
          </div>
          <div className="line-chart">
            <div className="chart-axis">
              {[1, 0.75, 0.5, 0.25, 0].map((n) => (
                <span key={n}>{compactMoney(max * n)}</span>
              ))}
            </div>
            <div className="chart-canvas">
              <div className="chart-grid">
                {[1, 2, 3, 4, 5].map((n) => (
                  <i key={n} />
                ))}
              </div>
              <svg
                viewBox="0 0 660 175"
                preserveAspectRatio="none"
                role="img"
                aria-label={`Gross sales over the last ${range} days: ${money(revenue)}`}
              >
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#498c70" stopOpacity=".18" />
                    <stop offset="100%" stopColor="#498c70" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon points={`0,175 ${points} 660,175`} fill="url(#salesFill)" />
                <polyline
                  points={points}
                  fill="none"
                  stroke="#407c61"
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                />
                {days.map((d, n) => (
                  <circle
                    key={n}
                    cx={(n * 660) / (days.length - 1)}
                    cy={175 - (d.value / max) * 175}
                    r="3"
                    fill="#fff"
                    stroke="#407c61"
                    strokeWidth="2"
                  >
                    <title>
                      {d.label}: {money(d.value)}
                    </title>
                  </circle>
                ))}
              </svg>
              <div className="chart-labels">
                {days
                  .filter((_, i) => i % 2 === 0)
                  .map((d) => (
                    <span key={d.label}>{d.label}</span>
                  ))}
              </div>
            </div>
          </div>
        </section>
        <section className="panel mix-panel">
          <div className="panel-header">
            <div>
              <h3>Sales by customer</h3>
              <p>Every kind of customer, covered</p>
            </div>
            <span className="tiny-tag">B2B + B2C</span>
          </div>
          <div className="donut-wrap">
            <div
              className="donut"
              style={{
                background: `conic-gradient(#36654e 0% ${b2bPct}%, #d5e5bb ${b2bPct}% 100%)`,
              }}
            >
              <div>
                <span>Total sales</span>
                <strong>{compactMoney(revenue)}</strong>
                <small>{invoices.length} invoices</small>
              </div>
            </div>
          </div>
          <div className="mix-legend">
            <div>
              <i />
              <span>
                Business <small>B2B</small>
              </span>
              <strong>{b2bPct}%</strong>
            </div>
            <div>
              <i />
              <span>
                Consumer <small>B2C</small>
              </span>
              <strong>{revenue ? 100 - b2bPct : 0}%</strong>
            </div>
          </div>
        </section>
      </div>
      <div className="main-lower-grid">
        <section className="panel recent-panel">
          <div className="panel-header">
            <div>
              <h3>
                Recent invoices <span className="count-pill">{data.invoices.length}</span>
              </h3>
              <p>Your latest sales, all in one place</p>
            </div>
            <MiniLink onClick={() => navigate('Invoices')}>View all invoices</MiniLink>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Invoice / Customer</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.invoices.slice(0, 5).map((i) => (
                  <tr key={i.id} onClick={() => viewInvoice(i)} className="clickable">
                    <td>
                      <div className="person-cell">
                        <Avatar name={i.customer.name} />
                        <div>
                          <strong>{i.customer.name}</strong>
                          <span>
                            {i.number} <b>·</b> {i.customer.type}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="muted">{dateLabel(i.date).replace(/ 202\d/, '')}</td>
                    <td className="amount">{money(invoiceTotals(i).total)}</td>
                    <td>
                      <Badge value={status(i)} />
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`View invoice ${i.number}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          viewInvoice(i);
                        }}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.invoices.length === 0 && (
              <Empty
                title="Your first sale starts here"
                text="Create an invoice and keep your business moving."
                action={
                  <button className="button primary" onClick={newInvoice}>
                    Create invoice
                  </button>
                }
              />
            )}
          </div>
          <div className="table-footer">
            <span>
              <CircleCheck size={14} />
              All amounts in Indian Rupees (INR)
            </span>
            <span>GST included</span>
          </div>
        </section>
        <section className="panel attention-panel">
          <div className="panel-header">
            <div>
              <h3>Needs your attention</h3>
              <p>A few things to keep things moving</p>
            </div>
            <span className="attention-count">{lowStock.length + overdue.length}</span>
          </div>
          <button className="attention-item" onClick={() => navigate('Invoices')}>
            <span className="attention-icon orange">
              <Clock3 size={18} />
            </span>
            <div>
              <strong>{overdue.length} overdue invoices</strong>
              <p>{money(overdue.reduce((s, i) => s + balance(i), 0))} awaiting collection</p>
            </div>
            <ArrowUpRight size={17} />
          </button>
          <div className="attention-divider" />
          <div className="stock-title">
            <span>
              <Package size={15} />
              Running low on stock
            </span>
            <button onClick={() => navigate('Inventory')}>View inventory</button>
          </div>
          {lowStock.slice(0, 3).map((p) => (
            <button className="low-stock-row" key={p.id} onClick={() => navigate('Inventory')}>
              <ProductIcon color={p.color} />
              <div>
                <strong>{p.name}</strong>
                <span>{p.sku}</span>
              </div>
              <small>{p.stock} left</small>
            </button>
          ))}
          {!lowStock.length && (
            <p className="stock-clear">All stocked up. You’re ready for the next sale.</p>
          )}
          <div className="attention-tip">
            <span>✧</span>
            <p>
              A healthy business starts with
              <br />
              <strong>the little things, done well.</strong>
            </p>
          </div>
        </section>
      </div>
      <section className="channel-strip">
        <div>
          <span className="channel-icon">
            <ShoppingBag size={19} />
          </span>
          <div>
            <strong>One business. Every channel.</strong>
            <p>Keep all your sales in the same place.</p>
          </div>
        </div>
        <div className="channel-labels">
          {[
            { name: 'Direct', icon: <Store size={16} /> },
            { name: 'Website', icon: <Globe size={16} /> },
            { name: 'Amazon', icon: <ShoppingBag size={16} /> },
            { name: 'Flipkart', icon: <ShoppingBag size={16} /> },
          ].map((c) => (
            <button key={c.name} onClick={() => navigate('Reports')}>
              {c.icon}
              {c.name}
              <span>{invoices.filter((i) => i.channel === c.name).length}</span>
            </button>
          ))}
        </div>
      </section>
      <footer className="page-footer">
        <span>Made for your next chapter.</span>
        <span>
          <span className="live-dot" />{' '}
          {mode === 'demo' ? 'Demo data saved on this device' : 'Connected to your cloud workspace'}
        </span>
      </footer>
    </>
  );
}
