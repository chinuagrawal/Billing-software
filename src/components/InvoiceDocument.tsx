import { Fragment } from 'react';
import type { Invoice, InvoiceTemplate } from '../types';
import { balance, dateLabel, invoiceTotals, money, STATES, totals } from '../lib/billing';
import { amountInWords, taxSummary } from '../lib/invoiceTemplates';

function LineItems({ invoice: i, classic }: { invoice: Invoice; classic: boolean }) {
  const sum = invoiceTotals(i);
  const sameUnit = i.items.length > 0 && i.items.every((item) => item.unit === i.items[0].unit);
  return (
    <table className="bill-items">
      <colgroup>
        {[4, 25, 10, 8, 7, 14, 14, 18].map((width, n) => (
          <col key={n} style={{ width: `${width}%` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th>#</th>
          <th>Item name</th>
          <th>HSN / SAC</th>
          <th>Quantity</th>
          <th>Unit</th>
          <th>Price / unit (₹)</th>
          <th>GST (₹)</th>
          <th>Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        {i.items.map((item, n) => {
          const line = totals([item], i.business.state !== i.placeOfSupply);
          return (
            <tr key={n}>
              <td>{n + 1}</td>
              <td>
                <strong>{item.name}</strong>
                {item.discount > 0 && (
                  <small>
                    {item.discount}% discount · {money(line.discount)}
                  </small>
                )}
              </td>
              <td>{item.hsn || '-'}</td>
              <td className="bill-number">{item.qty}</td>
              <td>{item.unit}</td>
              <td className="bill-number">{money(item.price)}</td>
              <td className="bill-number">
                {money(line.tax)}
                <small>({item.gst}%)</small>
              </td>
              <td className="bill-number">{money(line.total)}</td>
            </tr>
          );
        })}
        {classic && i.items.length < 8 && (
          <tr className="bill-spacer" aria-hidden="true">
            {Array.from({ length: 8 }, (_, n) => (
              <td key={n} style={{ height: `${Math.max(28, 190 - i.items.length * 17)}px` }} />
            ))}
          </tr>
        )}
        <tr className="bill-items-total">
          <td />
          <td colSpan={2}>
            <strong>Total</strong>
            <small>
              {i.items.length} line item{i.items.length === 1 ? '' : 's'}
            </small>
          </td>
          <td className="bill-number">
            {sameUnit
              ? i.items
                  .reduce((n, item) => n + item.qty, 0)
                  .toLocaleString('en-IN', { maximumFractionDigits: 6 })
              : '-'}
          </td>
          <td>{sameUnit ? i.items[0].unit : 'Mixed'}</td>
          <td />
          <td className="bill-number">
            <strong>{money(sum.tax)}</strong>
          </td>
          <td className="bill-number">
            <strong>{money(sum.unroundedTotal)}</strong>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function TaxSummary({ invoice: i }: { invoice: Invoice }) {
  const interstate = i.business.state !== i.placeOfSupply;
  const union = ['04', '26', '31', '35', '38'].includes(i.placeOfSupply);
  const summary = taxSummary(i),
    sum = invoiceTotals(i);
  return (
    <section className="bill-tax-summary">
      <h4>Tax summary</h4>
      <table>
        <thead>
          <tr>
            <th rowSpan={2}>HSN / SAC</th>
            <th rowSpan={2}>Taxable value (₹)</th>
            {interstate ? (
              <th colSpan={2}>IGST</th>
            ) : (
              <>
                <th colSpan={2}>CGST</th>
                <th colSpan={2}>{union ? 'UTGST' : 'SGST'}</th>
              </>
            )}
            <th rowSpan={2}>Total tax (₹)</th>
          </tr>
          <tr>
            {Array.from({ length: interstate ? 1 : 2 }, (_, n) => (
              <Fragment key={n}>
                <th>Rate %</th>
                <th>Amount (₹)</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {summary.map((row) => (
            <tr key={`${row.hsn}:${row.rate}`}>
              <td>{row.hsn || '-'}</td>
              <td>{money(row.taxable)}</td>
              {interstate ? (
                <>
                  <td>{row.rate}%</td>
                  <td>{money(row.igst)}</td>
                </>
              ) : (
                <>
                  <td>{row.rate / 2}%</td>
                  <td>{money(row.cgst)}</td>
                  <td>{row.rate / 2}%</td>
                  <td>{money(row.sgst)}</td>
                </>
              )}
              <td>{money(row.tax)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>Total</th>
            <th>{money(sum.taxable)}</th>
            {interstate ? (
              <>
                <td />
                <th>{money(sum.igst)}</th>
              </>
            ) : (
              <>
                <td />
                <th>{money(sum.cgst)}</th>
                <td />
                <th>{money(sum.sgst)}</th>
              </>
            )}
            <th>{money(sum.tax)}</th>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

function AmountSummary({ invoice: i }: { invoice: Invoice }) {
  const sum = invoiceTotals(i),
    interstate = i.business.state !== i.placeOfSupply;
  return (
    <section className="bill-amount-summary">
      <dl>
        <dt>Subtotal</dt>
        <dd>{money(sum.subtotal)}</dd>
        {sum.discount > 0 && (
          <>
            <dt>Discount</dt>
            <dd>- {money(sum.discount)}</dd>
          </>
        )}
        <dt>Taxable value</dt>
        <dd>{money(sum.taxable)}</dd>
        {interstate ? (
          <>
            <dt>IGST</dt>
            <dd>{money(sum.igst)}</dd>
          </>
        ) : (
          <>
            <dt>CGST</dt>
            <dd>{money(sum.cgst)}</dd>
            <dt>{['04', '26', '31', '35', '38'].includes(i.placeOfSupply) ? 'UTGST' : 'SGST'}</dt>
            <dd>{money(sum.sgst)}</dd>
          </>
        )}
        {i.roundOff !== undefined && (
          <>
            <dt>Round off</dt>
            <dd>
              {sum.roundOff > 0 ? '+' : ''}
              {money(sum.roundOff)}
            </dd>
          </>
        )}
        <dt className="bill-grand">Invoice total</dt>
        <dd className="bill-grand">{money(sum.total)}</dd>
      </dl>
      <div className="bill-words">
        <h4>Invoice amount in words</h4>
        <p>{amountInWords(sum.total)}</p>
      </div>
      <dl>
        <dt>Received</dt>
        <dd>{money(i.paid)}</dd>
        <dt>Balance due</dt>
        <dd>{money(balance(i))}</dd>
      </dl>
    </section>
  );
}

function Notes({ invoice: i }: { invoice: Invoice }) {
  return (
    <div className="bill-notes">
      {(i.business.bankName || i.business.upi) && (
        <>
          <h4>Payment details</h4>
          {i.business.bankName && (
            <p>
              {i.business.bankName}
              <br />
              Account: {i.business.account}
              <br />
              IFSC: {i.business.ifsc}
            </p>
          )}
          {i.business.upi && <p>UPI: {i.business.upi}</p>}
        </>
      )}
      {(i.notes || i.business.terms) && (
        <>
          <h4>Notes & terms</h4>
          {i.notes && <p>{i.notes}</p>}
          {i.business.terms && <p>{i.business.terms}</p>}
        </>
      )}
    </div>
  );
}

export function InvoiceDocument({
  invoice: i,
  template,
  sample = false,
}: {
  invoice: Invoice;
  template: InvoiceTemplate;
  sample?: boolean;
}) {
  const classic = template === 'classic';
  const label =
    i.status === 'draft' ? 'Draft invoice' : i.status === 'void' ? 'Void invoice' : 'Tax invoice';
  const monogram = i.business.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (
    <div className="invoice-preview-scroll">
      <article
        className={`invoice-paper invoice-document invoice-template-${template}`}
        id="print-invoice"
        data-template={template}
      >
        {sample && <div className="sample-watermark">SAMPLE · DEMONSTRATION ONLY</div>}
        <div className="bill-document-title">{label}</div>
        <header className="bill-seller">
          {template !== 'minimal' && (
            <div className="bill-monogram" aria-hidden="true">
              {monogram}
            </div>
          )}
          <div>
            <h2>{i.business.name}</h2>
            <p>{i.business.address || 'Registered address not configured'}</p>
            <div className="bill-seller-details">
              <p>
                Phone: <strong>{i.business.phone || '-'}</strong>
              </p>
              <p>
                Email: <strong>{i.business.email || '-'}</strong>
              </p>
              <p>
                GSTIN: <strong>{i.business.gstin || 'Not configured'}</strong>
              </p>
              <p>
                State:{' '}
                <strong>
                  {i.business.state}-{STATES[i.business.state] || '-'}
                </strong>
              </p>
            </div>
          </div>
        </header>
        <div className="bill-parties">
          <section>
            <h4>Bill to</h4>
            <div className="bill-party-body">
              <strong>{i.customer.name}</strong>
              <p>{i.customer.address}</p>
              <p>Contact: {i.customer.phone || '-'}</p>
              <p>
                GSTIN: <strong>{i.customer.gstin || 'Unregistered (B2C)'}</strong>
              </p>
              <p>
                State: {i.customer.state}-{STATES[i.customer.state]}
              </p>
              {i.shippingAddress && i.shippingAddress !== i.customer.address && (
                <p>
                  <strong>Ship to:</strong> {i.shippingAddress}
                </p>
              )}
            </div>
          </section>
          <section>
            <h4>Invoice details</h4>
            <dl className="bill-meta">
              <dt>Invoice no.</dt>
              <dd>{i.number}</dd>
              <dt>Invoice date</dt>
              <dd>{dateLabel(i.date)}</dd>
              <dt>Due date</dt>
              <dd>{dateLabel(i.dueDate)}</dd>
              <dt>Place of supply</dt>
              <dd>
                {i.placeOfSupply}-{STATES[i.placeOfSupply]}
              </dd>
              {i.reference && (
                <>
                  <dt>Reference</dt>
                  <dd>{i.reference}</dd>
                </>
              )}
              <dt>Reverse charge</dt>
              <dd>No</dd>
            </dl>
          </section>
        </div>
        <LineItems invoice={i} classic={classic} />
        <div className="bill-summary-grid">
          <div>
            <TaxSummary invoice={i} />
            <Notes invoice={i} />
          </div>
          <AmountSummary invoice={i} />
        </div>
        <div className="bill-signature">
          <h4>For {i.business.name}</h4>
          <div />
          <p>Authorised signatory</p>
        </div>
        <footer>Original for recipient · All amounts in INR · Thank you for your business.</footer>
      </article>
    </div>
  );
}
