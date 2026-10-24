import { useState } from 'react';
import { Printer, Pencil, Wallet, Ban } from 'lucide-react';
import type { Invoice } from '../types';
import { balance, dateLabel, invoiceTotals, money, STATES, status, totals } from '../lib/billing';
import { useStore } from '../lib/store';
import { Badge } from './ui';
export function InvoiceView({
  invoice,
  onEdit,
  onPay,
  onDone,
}: {
  invoice: Invoice;
  onEdit: () => void;
  onPay: () => void;
  onDone: (s: string) => void;
}) {
  const { execute, mode } = useStore();
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const i = invoice,
    sum = invoiceTotals(i),
    interstate = i.business.state !== i.placeOfSupply;
  async function voidInvoice() {
    setBusy(true);
    try {
      await execute({ type: 'void', id: i.id });
      onDone('Invoice voided. Stock has been restored.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="invoice-toolbar no-print">
        <Badge value={status(i)} />
        <div>
          {i.status === 'draft' && (
            <button className="button secondary" onClick={onEdit}>
              <Pencil size={15} />
              Edit draft
            </button>
          )}
          {i.status === 'issued' && balance(i) > 0 && (
            <button className="button primary" onClick={onPay}>
              <Wallet size={15} />
              Record payment
            </button>
          )}
          <button className="button secondary" onClick={() => window.print()}>
            <Printer size={15} />
            Print / PDF
          </button>
          {i.status === 'issued' && !i.paid && (
            <button
              title="Void invoice"
              aria-label="Void invoice"
              className="icon-button danger-text"
              onClick={() => setConfirm(true)}
            >
              <Ban size={17} />
            </button>
          )}
        </div>
      </div>
      {confirm && (
        <div className="confirm-panel no-print">
          <strong>Void {i.number}?</strong>
          <p>
            This keeps the invoice in your records and restores its stock. The invoice number cannot
            be reused.
          </p>
          <div>
            <button className="button secondary" onClick={() => setConfirm(false)}>
              Keep invoice
            </button>
            <button className="button danger" disabled={busy} onClick={voidInvoice}>
              {busy ? 'Voiding…' : 'Void invoice'}
            </button>
          </div>
        </div>
      )}
      {error && <div className="error-banner">{error}</div>}
      <article className="invoice-paper" id="print-invoice">
        {mode === 'demo' && <div className="sample-watermark">SAMPLE · DEMONSTRATION ONLY</div>}
        <header className="invoice-paper-head">
          <div>
            <span className="brand-mark">
              a<span>e</span>
            </span>
            <h2>{i.business.name}</h2>
            <p>{i.business.address}</p>
            <p>
              {i.business.email} {i.business.phone && `· ${i.business.phone}`}
            </p>
            <strong>GSTIN: {i.business.gstin || 'Not configured'}</strong>
          </div>
          <div>
            <span className="invoice-document-label">
              {i.status === 'draft'
                ? 'DRAFT INVOICE'
                : i.status === 'void'
                  ? 'VOID INVOICE'
                  : 'TAX INVOICE'}
            </span>
            <h2>{i.number}</h2>
            <p>Original for recipient</p>
            <dl>
              <dt>Invoice date</dt>
              <dd>{dateLabel(i.date)}</dd>
              <dt>Due date</dt>
              <dd>{dateLabel(i.dueDate)}</dd>
              {i.reference && (
                <>
                  <dt>Reference</dt>
                  <dd>{i.reference}</dd>
                </>
              )}
            </dl>
          </div>
        </header>
        <div className="invoice-addresses">
          <section>
            <h4>BILL TO</h4>
            <strong>{i.customer.name}</strong>
            <p>{i.customer.address}</p>
            <p>
              {STATES[i.customer.state]} · {i.customer.state}
            </p>
            <p>GSTIN: {i.customer.gstin || 'Unregistered (B2C)'}</p>
          </section>
          <section>
            <h4>SHIP TO</h4>
            <p>{i.shippingAddress || i.customer.address}</p>
            <p>
              <strong>Place of supply:</strong> {STATES[i.placeOfSupply]} ({i.placeOfSupply})
            </p>
            <p>Reverse charge: No</p>
          </section>
        </div>
        <table className="print-table">
          <thead>
            <tr>
              <th># / Description</th>
              <th>HSN</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Disc.</th>
              <th>GST</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {i.items.map((item, n) => (
              <tr key={n}>
                <td>
                  {n + 1}. {item.name}
                </td>
                <td>{item.hsn}</td>
                <td>
                  {item.qty} {item.unit}
                </td>
                <td>{money(item.price)}</td>
                <td>{item.discount}%</td>
                <td>{item.gst}%</td>
                <td>{money(totals([item], interstate).total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="invoice-bottom">
          <div>
            <h4>PAYMENT DETAILS</h4>
            {i.business.bankName ? (
              <>
                <p>{i.business.bankName}</p>
                <p>Account: {i.business.account}</p>
                <p>IFSC: {i.business.ifsc}</p>
              </>
            ) : (
              <p>Contact the business for bank details.</p>
            )}
            {i.business.upi && <p>UPI: {i.business.upi}</p>}
            <h4>NOTES & TERMS</h4>
            <p>{i.notes}</p>
            <p>{i.business.terms}</p>
          </div>
          <div className="totals-box">
            <div>
              <span>Subtotal</span>
              <strong>{money(sum.subtotal)}</strong>
            </div>
            <div>
              <span>Discount</span>
              <strong>− {money(sum.discount)}</strong>
            </div>
            <div>
              <span>Taxable value</span>
              <strong>{money(sum.taxable)}</strong>
            </div>
            {interstate ? (
              <div>
                <span>IGST</span>
                <strong>{money(sum.igst)}</strong>
              </div>
            ) : (
              <>
                <div>
                  <span>CGST</span>
                  <strong>{money(sum.cgst)}</strong>
                </div>
                <div>
                  <span>
                    {['04', '26', '31', '35', '38'].includes(i.placeOfSupply) ? 'UTGST' : 'SGST'}
                  </span>
                  <strong>{money(sum.sgst)}</strong>
                </div>
              </>
            )}
            <div className="grand-total">
              <span>Invoice total</span>
              <strong>{money(sum.total)}</strong>
            </div>
            <div>
              <span>Amount paid</span>
              <strong>{money(i.paid)}</strong>
            </div>
            <div>
              <span>Balance due</span>
              <strong>{money(balance(i))}</strong>
            </div>
          </div>
        </div>
        <div className="invoice-signature">
          <p>For {i.business.name}</p>
          <div />
          <strong>Authorised signatory</strong>
        </div>
        <footer>Thank you for choosing {i.business.name}.</footer>
      </article>
    </>
  );
}
