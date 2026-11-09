import { useEffect, useState } from 'react';
import { Printer, Pencil, Wallet, Ban, Trash2 } from 'lucide-react';
import type { Invoice } from '../types';
import { paymentBalance as balance, status, money } from '../lib/billing';
import { useStore } from '../lib/store';
import { Badge } from './ui';
import { InvoiceDocument } from './InvoiceDocument';
import { resolveTemplate } from '../lib/invoiceTemplates';
import { InvoiceFileActions } from './InvoiceFileActions';
import { invoiceFilename } from '../lib/invoiceFiles';
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
  const [reopen, setReopen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [unfiled, setUnfiled] = useState(false);
  const i = invoice;
  const template = resolveTemplate(data.business.invoiceTemplate || i.business.invoiceTemplate);
  const filename = invoiceFilename(i, mode === 'demo');
  useEffect(() => {
    const previous = document.title;
    document.title = filename.replace(/\.pdf$/i, '');
    return () => {
      document.title = previous;
    };
  }, [filename]);
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
          {(i.status === 'draft' || i.status === 'void') && (
            <button className="button secondary" disabled={busy} onClick={onEdit}>
              <Pencil size={15} />
              {i.status === 'void' ? 'Create draft copy' : 'Edit draft'}
            </button>
          )}
          {i.status === 'issued' && (
            <button className="button secondary" disabled={busy} onClick={() => setReopen(true)}>
              Reopen as draft
            </button>
          )}
          {i.status !== 'void' && balance(i) > 0 && (
            <button className="button primary" onClick={onPay}>
              <Wallet size={15} />
              Record payment
            </button>
          )}
          <button className="button secondary" onClick={() => window.print()}>
            <Printer size={15} />
            Print / PDF
          </button>
          {i.status === 'draft' && i.number === 'DRAFT' && !i.paid && (
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
      <div className="no-print">
        <InvoiceFileActions invoice={i} template={template} sample={mode === 'demo'} />
      </div>
      <section className="invoice-payment-summary no-print" aria-label="Private payment summary">
        <small>Payment tracking · Only in your workspace</small>
        <div>
          <span>
            Amount received <strong>{money(i.paid)}</strong>
          </span>
          <span>
            Balance due <strong>{money(balance(i))}</strong>
          </span>
        </div>
      </section>
      {reopen && (
        <div className="confirm-panel no-print">
          <strong>Reopen {i.number} as draft</strong>
          <p>
            The invoice number and payment stay linked to this invoice. Stock is restored until you
            issue it again. Complete the correction before exporting GSTR-1.
          </p>
          <label>
            <input
              type="checkbox"
              checked={unfiled}
              onChange={(e) => setUnfiled(e.target.checked)}
            />{' '}
            I confirm this invoice has not been filed in GSTR-1 and has no e-invoice IRN.
          </label>
          <input
            aria-label="Reason for reopening"
            placeholder="Reason for correction"
            maxLength={500}
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
          />
          <button className="button secondary" disabled={busy} onClick={() => setReopen(false)}>
            Back
          </button>
          <button
            className="button primary"
            disabled={busy || !unfiled || reopenReason.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await execute({
                  type: 'reopenInvoice',
                  id: i.id,
                  reason: reopenReason,
                  unfiledConfirmed: true,
                });
                onDone(
                  'Invoice reopened. Open it and choose Edit draft. Its number and payments are retained.',
                );
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirm reopen as draft
          </button>
        </div>
      )}
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
      <InvoiceDocument invoice={i} template={template} sample={mode === 'demo'} />
    </>
  );
}
