import { useState } from 'react';
import { Download, FileSpreadsheet, BarChart3, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { useStore } from '../lib/store';
import { balance, csv, download, invoiceTotals, money, today } from '../lib/billing';
import { SectionTitle, Empty } from './ui';
export function Reports() {
  const { data } = useStore();
  const [from, setFrom] = useState(today().slice(0, 7) + '-01'),
    [to, setTo] = useState(today());
  const invoices = data.invoices.filter(
    (i) => i.status === 'issued' && i.date >= from && i.date <= to,
  );
  const sums = invoices.reduce(
    (s, i) => {
      const t = invoiceTotals(i);
      return {
        taxable: s.taxable + t.taxable,
        cgst: s.cgst + t.cgst,
        sgst: s.sgst + t.sgst,
        igst: s.igst + t.igst,
        total: s.total + t.total,
      };
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 },
  );
  const taxRows = invoices.flatMap((i) =>
    i.items.map((item) => {
      const gross = item.price * item.qty * (1 - item.discount / 100);
      return [
        i.number,
        i.date,
        i.customer.name,
        i.customer.type,
        i.customer.gstin,
        i.placeOfSupply,
        item.hsn,
        item.name,
        item.qty,
        item.gst,
        Number(gross.toFixed(2)),
        i.channel,
      ];
    }),
  );
  return (
    <>
      <SectionTitle
        title="Reports & GST"
        subtitle="Turn your numbers into your next move."
        action={
          <div className="range-fields">
            <input
              aria-label="Report start date"
              type="date"
              max={to}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span>to</span>
            <input
              aria-label="Report end date"
              type="date"
              min={from}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        }
      />
      <div className="stats-grid report-stats">
        {[
          ['Taxable sales', sums.taxable],
          ['CGST collected', sums.cgst],
          ['SGST / UTGST collected', sums.sgst],
          ['IGST collected', sums.igst],
        ].map(([label, value]) => (
          <div className="stat-card" key={label}>
            <div className="stat-top">
              {label}
              <FileSpreadsheet size={17} />
            </div>
            <h2>{money(Number(value))}</h2>
            <small>{invoices.length} issued invoices in selected period</small>
          </div>
        ))}
      </div>
      <div className="analytics-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Sales by channel</h3>
              <p>Compare the places your customers shop</p>
            </div>
            <BarChart3 size={20} />
          </div>
          <div className="channel-report">
            {['Direct', 'Website', 'Amazon', 'Flipkart'].map((channel) => {
              const rows = invoices.filter((i) => i.channel === channel),
                sum = rows.reduce((s, i) => s + invoiceTotals(i).total, 0);
              return (
                <div key={channel}>
                  <div>
                    <strong>{channel}</strong>
                    <span>
                      {rows.length} invoices · <b>{money(sum)}</b>
                    </span>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${sums.total ? (sum / sums.total) * 100 : 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Receivables ageing</h3>
              <p>All outstanding invoices, as of today</p>
            </div>
            <ArrowUpRight size={20} />
          </div>
          <div className="ageing-report">
            {['Not due', '1–30 days', '31–60 days', '61+ days'].map((label, n) => {
              const amount = data.invoices
                .filter((i) => {
                  const days = Math.floor(
                    (new Date(today()).getTime() - new Date(i.dueDate).getTime()) / 86400000,
                  );
                  return (
                    balance(i) > 0 &&
                    (n === 0
                      ? days <= 0
                      : n === 1
                        ? days > 0 && days <= 30
                        : n === 2
                          ? days > 30 && days <= 60
                          : days > 60)
                  );
                })
                .reduce((s, i) => s + balance(i), 0);
              return (
                <div key={label}>
                  <span>
                    <i className={`age-dot age-${n}`} />
                    {label}
                  </span>
                  <strong>{money(amount)}</strong>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <section className="panel gst-panel">
        <div className="panel-header">
          <div>
            <h3>GST sales register</h3>
            <p>A clear breakdown for your accountant</p>
          </div>
          <button
            className="button secondary"
            onClick={() =>
              download(
                `gst-sales-${from}-${to}.csv`,
                csv([
                  [
                    'Invoice',
                    'Date',
                    'Customer',
                    'Type',
                    'GSTIN',
                    'Place of supply',
                    'HSN/SAC',
                    'Description',
                    'Quantity',
                    'GST %',
                    'Taxable value',
                    'Channel',
                  ],
                  ...taxRows,
                ]),
              )
            }
          >
            <Download size={16} />
            Export GST register
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Customer segment</th>
                <th>Invoices</th>
                <th>Taxable value</th>
                <th>CGST</th>
                <th>SGST / UTGST</th>
                <th>IGST</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {['B2B', 'B2C'].map((type) => {
                const rows = invoices.filter((i) => i.customer.type === type),
                  t = rows.reduce(
                    (s, i) => {
                      const v = invoiceTotals(i);
                      return {
                        taxable: s.taxable + v.taxable,
                        cgst: s.cgst + v.cgst,
                        sgst: s.sgst + v.sgst,
                        igst: s.igst + v.igst,
                        total: s.total + v.total,
                      };
                    },
                    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 },
                  );
                return (
                  <tr key={type}>
                    <td>
                      <strong>{type === 'B2B' ? 'Business customers' : 'Consumers'}</strong>
                      <small>{type}</small>
                    </td>
                    <td>{rows.length}</td>
                    <td>{money(t.taxable)}</td>
                    <td>{money(t.cgst)}</td>
                    <td>{money(t.sgst)}</td>
                    <td>{money(t.igst)}</td>
                    <td className="amount">{money(t.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="report-note">
          <ShieldCheck size={18} />
          <p>
            This register supports your accounting review. GST return filing, IRN / e-invoice
            generation and e-way bills are not connected. Confirm product tax rates and applicable
            requirements with your accountant.
          </p>
        </div>
      </section>
      <section className="panel activity-panel">
        <div className="panel-header">
          <div>
            <h3>Activity log</h3>
            <p>A record of the changes made in your workspace</p>
          </div>
        </div>
        {data.audit.length ? (
          data.audit.slice(0, 10).map((a) => (
            <div className="activity-item" key={a.id}>
              <span className="activity-dot" />
              <div>
                <strong>{a.action}</strong>
                <p>{a.detail}</p>
              </div>
              <time>
                {new Date(a.at).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
            </div>
          ))
        ) : (
          <Empty title="A fresh start" text="Your workspace activity will appear here." />
        )}
      </section>
    </>
  );
}
