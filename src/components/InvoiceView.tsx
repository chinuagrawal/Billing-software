import { useState } from 'react';
import { Printer, Pencil, Wallet, Ban } from 'lucide-react';
import type { Invoice } from '../types';
import { balance, status } from '../lib/billing';
import { useStore } from '../lib/store';
import { Badge } from './ui';
import { InvoiceDocument } from './InvoiceDocument';
import { resolveTemplate } from '../lib/invoiceTemplates';
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
  const { execute, mode, data } = useStore();
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const i = invoice;
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
      <InvoiceDocument
        invoice={i}
        template={resolveTemplate(data.business.invoiceTemplate || i.business.invoiceTemplate)}
        sample={mode === 'demo'}
      />
    </>
  );
}
