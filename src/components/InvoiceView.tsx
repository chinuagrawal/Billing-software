import { useState } from 'react';
import { Printer, Pencil, Wallet, Ban, Trash2 } from 'lucide-react';
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
      await execute({ type: i.status === 'draft' ? 'deleteDraft' : 'void', id: i.id });
      onDone(
        i.status === 'draft' ? 'Draft deleted.' : 'Invoice cancelled. Stock has been restored.',
      );
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
            <button className="button secondary" disabled={busy} onClick={onEdit}>
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
          {i.status === 'draft' && (
            <button
              className="button secondary danger-text"
              disabled={busy}
              onClick={() => {
                setError('');
                setConfirm(true);
              }}
            >
              <Trash2 size={17} /> Delete draft
            </button>
          )}
          {i.status === 'issued' && !i.paid && (
            <button
              className="button secondary danger-text"
              disabled={busy}
              onClick={() => {
                setError('');
                setConfirm(true);
              }}
            >
              <Ban size={17} />
              Cancel invoice
            </button>
          )}
        </div>
      </div>
      {confirm && (
        <div className="confirm-panel no-print">
          <strong>{i.status === 'draft' ? 'Delete this draft?' : `Cancel ${i.number}?`}</strong>
          <p>
            {i.status === 'draft'
              ? 'This permanently removes the draft. It has not used an invoice number or changed stock. This cannot be undone.'
              : 'This keeps the invoice in your records as Void and restores its stock. The invoice number cannot be reused.'}
          </p>
          <div>
            <button className="button secondary" disabled={busy} onClick={() => setConfirm(false)}>
              Keep invoice
            </button>
            <button className="button danger" disabled={busy} onClick={voidInvoice}>
              {busy
                ? 'Saving…'
                : i.status === 'draft'
                  ? 'Delete draft permanently'
                  : 'Confirm cancellation'}
            </button>
          </div>
        </div>
      )}
      {i.status === 'issued' && i.paid > 0 && (
        <p className="form-hint no-print">
          This invoice has recorded payments and cannot be deleted or cancelled here. A
          credit-note/refund workflow is needed for corrections; that workflow is not yet available.
        </p>
      )}
      {i.status === 'void' && (
        <p className="form-hint no-print">
          This invoice is cancelled (Void). It stays in your records, and its invoice number cannot
          be reused.
        </p>
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
