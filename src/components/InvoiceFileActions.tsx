import { useEffect, useState } from 'react';
import { Download, Share2, RefreshCw } from 'lucide-react';
import type { Invoice, InvoiceTemplate } from '../types';
import { invoiceFilename, saveInvoiceFile, shareInvoiceFile } from '../lib/invoiceFiles';

export function InvoiceFileActions({
  invoice,
  template,
  sample,
}: {
  invoice: Invoice;
  template: InvoiceTemplate;
  sample: boolean;
}) {
  const [result, setResult] = useState<{ key: string; file?: File; error?: string } | null>(null);
  const [retry, setRetry] = useState(0),
    [sharing, setSharing] = useState(false),
    [notice, setNotice] = useState('');
  const key = JSON.stringify([invoice, template, sample]);
  const file = result?.key === key ? result.file : undefined,
    error = result?.key === key ? result.error : undefined;
  useEffect(() => {
    let cancelled = false;
    const snapshot = JSON.parse(key) as [Invoice, InvoiceTemplate, boolean];
    setNotice('');
    import('../lib/invoicePdf')
      .then((module) => module.invoicePdfBlob(...snapshot))
      .then((blob) => {
        if (!cancelled)
          setResult({
            key,
            file: new File([blob], invoiceFilename(snapshot[0], snapshot[2]), {
              type: 'application/pdf',
            }),
          });
      })
      .catch(() => {
        if (!cancelled)
          setResult({ key, error: 'PDF preparation failed. Retry or use Print / PDF.' });
      });
    return () => {
      cancelled = true;
    };
  }, [key, retry]);
  return (
    <div className="invoice-file-actions">
      <div className="invoice-file-buttons">
        <button
          className="button secondary"
          disabled={!file || sharing}
          onClick={() => {
            if (file) {
              saveInvoiceFile(file);
              setNotice(`Saved as ${file.name}`);
            }
          }}
        >
          <Download size={15} />
          Save PDF
        </button>
        <button
          className="button secondary"
          disabled={!file || sharing}
          onClick={() => {
            if (!file) return;
            setSharing(true);
            setNotice('');
            void shareInvoiceFile(file)
              .then((outcome) => {
                if (outcome === 'downloaded')
                  setNotice(
                    `Sharing is not supported here. Saved as ${file.name}; attach it in WhatsApp or email.`,
                  );
                else if (outcome === 'shared') setNotice('Share request completed.');
              })
              .catch((error) =>
                setNotice(
                  error instanceof Error ? error.message : 'Unable to share. Use Save PDF.',
                ),
              )
              .finally(() => setSharing(false));
          }}
        >
          <Share2 size={15} />
          {sharing ? 'Sharing…' : 'Share PDF'}
        </button>
        {error && (
          <button
            className="button secondary"
            onClick={() => {
              setResult(null);
              setRetry((n) => n + 1);
            }}
          >
            <RefreshCw size={15} />
            Retry PDF
          </button>
        )}
      </div>
      <small role="status">{error || notice || (!file ? 'Preparing PDF…' : file.name)}</small>
    </div>
  );
}
