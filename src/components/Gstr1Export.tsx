import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useStore } from '../lib/store';
import { Field } from './ui';

export function Gstr1Export({ from, to }: { from: string; to: string }) {
  const { data, mode, loading, error: cloudError } = useStore();
  const [gstin, setGstin] = useState(data.business.gstin);
  const [hsn, setHsn] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState('');
  const gstins = [
    ...new Set(
      [
        data.business.gstin,
        ...data.invoices.filter((i) => i.status !== 'draft').map((i) => i.business.gstin),
      ].filter(Boolean),
    ),
  ];
  const selected = gstins.includes(gstin) ? gstin : data.business.gstin;
  return (
    <section className="panel gstr1-export">
      <div className="panel-header">
        <div>
          <h3>
            <FileSpreadsheet size={18} /> GSTR-1 Excel report
          </h3>
          <p>
            Prepare your return with invoice schedules, HSN summaries, document series and checks.
          </p>
        </div>
      </div>
      <form
        className="form-body"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          setDone('');
          try {
            const { downloadGstr1Excel } = await import('../lib/gstr1Excel');
            await downloadGstr1Excel(data, {
              from,
              to,
              gstin: selected,
              hsnDigits: hsn === '4' ? 4 : hsn === '6' ? 6 : null,
              demo: mode === 'demo',
            });
            setDone(`${from}:${to}:${selected}:${hsn}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to export Excel. Please retry.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Supplier GSTIN">
            <select
              required={mode !== 'demo'}
              value={selected}
              onChange={(e) => {
                setGstin(e.target.value);
                setDone('');
              }}
            >
              <option value="">
                {mode === 'demo' ? 'Demo supplier (GSTIN not set)' : 'Select GSTIN'}
              </option>
              {gstins.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Required HSN length"
            hint="Based on aggregate turnover in the preceding financial year."
          >
            <select
              value={hsn}
              onChange={(e) => {
                setHsn(e.target.value);
                setDone('');
              }}
            >
              <option value="">Not confirmed — flag for review</option>
              <option value="4">4 digits minimum · turnover up to ₹5 crore</option>
              <option value="6">6 digits minimum · turnover above ₹5 crore</option>
            </select>
          </Field>
        </div>
        <p className="form-hint">
          Selected invoice dates:{' '}
          <strong>
            {from} to {to}
          </strong>
          . Use the date controls above for a complete month or quarter.{' '}
          {mode === 'demo' && 'Demo export contains sample records only.'}
        </p>
        <p className="form-hint">
          Includes B2B, B2CL, B2CS, HSN B2B/B2C, documents issued, sales and item registers,
          zero-rate review, reconciliation and filing notes. Credit notes, exports, amendments and
          other unrecorded sections need separate review. This workbook supports preparation; it is
          not a GST Portal upload file.
        </p>
        {error && (
          <div role="alert" className="error-banner">
            {error}
          </div>
        )}
        {done === `${from}:${to}:${selected}:${hsn}` && (
          <p role="status">Excel report downloaded. Resolve the Review sheet before filing.</p>
        )}
        <div>
          <button className="button primary" disabled={busy || loading || Boolean(cloudError)}>
            <Download size={16} />
            {busy ? 'Preparing Excel…' : 'Download GSTR-1 Excel'}
          </button>
        </div>
        {cloudError && (
          <p role="alert">Resolve the cloud connection error before exporting a complete report.</p>
        )}
      </form>
    </section>
  );
}
