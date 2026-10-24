import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Eye, FileText } from 'lucide-react';
import type { Business, InvoiceTemplate } from '../types';
import { demoWorkspace } from '../lib/seed';
import { INVOICE_TEMPLATES } from '../lib/invoiceTemplates';
import { InvoiceDocument } from './InvoiceDocument';
import { Modal } from './ui';

function Miniature({ template }: { template: InvoiceTemplate }) {
  const classic = template === 'classic',
    color = template === 'modern' ? '#285340' : '#424754';
  return (
    <svg viewBox="0 0 180 142" aria-hidden="true" className={`invoice-style-mini mini-${template}`}>
      <rect x="18" y="6" width="144" height="130" rx="2" fill="white" stroke="#d7ddcf" />
      <rect x={classic ? 70 : 30} y="17" width={classic ? 40 : 68} height="5" rx="1" fill={color} />
      <rect x="30" y="30" width="83" height="3" fill="#b6bfae" />
      <rect x="30" y="37" width="113" height="2" fill="#d9dfd3" />
      {classic && (
        <rect x="27" y="27" width="126" height="31" fill="none" stroke={color} strokeWidth=".6" />
      )}
      <rect x="29" y="47" width="43" height="3" fill="#b5beae" />
      <rect x="104" y="47" width="43" height="3" fill="#b5beae" />
      <rect
        x="27"
        y="65"
        width="126"
        height="8"
        fill={template === 'modern' ? '#e4eddf' : '#f0f1ef'}
      />
      {[73, 84, 95, 106].map((y) => (
        <line key={y} x1="27" x2="153" y1={y} y2={y} stroke="#d8ddd2" strokeWidth=".7" />
      ))}
      {classic &&
        [27, 34, 82, 98, 118, 136, 153].map((x) => (
          <line key={x} x1={x} x2={x} y1="65" y2="106" stroke={color} strokeWidth=".5" />
        ))}
      <rect x="30" y="78" width="43" height="2" fill="#aebaa5" />
      <rect x="30" y="89" width="35" height="2" fill="#aebaa5" />
      <rect x="105" y="111" width="48" height="10" fill={template === 'modern' ? color : '#eee'} />
      <rect x="112" y="115" width="32" height="2" fill={template === 'modern' ? '#fff' : color} />
      <line x1="117" x2="151" y1="128" y2="128" stroke="#b6bfae" strokeWidth=".7" />
    </svg>
  );
}

export function InvoiceStylePicker({
  value,
  onChange,
  business,
}: {
  value: InvoiceTemplate;
  onChange: (value: InvoiceTemplate) => void;
  business: Business;
}) {
  const [preview, setPreview] = useState(false);
  const [sample] = useState(() => {
    const workspace = demoWorkspace();
    const invoice = workspace.invoices.find(
      (i) => i.status === 'issued' && i.placeOfSupply === i.business.state,
    )!;
    const product = workspace.products[0];
    return {
      ...invoice,
      paid: 0,
      items: [
        ...invoice.items,
        {
          productId: product.id,
          name: product.name,
          hsn: product.hsn,
          unit: product.unit,
          qty: 2,
          price: product.price,
          gst: product.gst,
          discount: 0,
        },
      ],
    };
  });
  return (
    <>
      <section className="panel settings-panel invoice-style-panel">
        <div className="panel-header">
          <div className="settings-title">
            <FileText size={20} />
            <div>
              <h3>Invoice appearance</h3>
              <p>Choose a layout for your printed and PDF bills</p>
            </div>
          </div>
        </div>
        <div className="form-body">
          <fieldset className="invoice-style-options">
            <legend>Billing style</legend>
            {INVOICE_TEMPLATES.map((template) => (
              <label
                className={`invoice-style-option ${value === template.id ? 'selected' : ''}`}
                key={template.id}
              >
                <input
                  type="radio"
                  name="invoice-template"
                  value={template.id}
                  checked={value === template.id}
                  onChange={() => onChange(template.id)}
                />
                <Miniature template={template.id} />
                <span className="invoice-style-name">
                  {template.name}
                  {value === template.id && <CheckCircle2 size={15} />}
                </span>
                <span className="invoice-style-description">{template.description}</span>
              </label>
            ))}
          </fieldset>
          <div className="invoice-style-actions">
            <p className="form-hint">Save changes to apply your chosen style to your bills.</p>
            <button type="button" className="button secondary" onClick={() => setPreview(true)}>
              <Eye size={16} />
              Preview selected style
            </button>
          </div>
        </div>
      </section>
      {preview &&
        createPortal(
          <Modal
            title={`${INVOICE_TEMPLATES.find((t) => t.id === value)?.name} invoice preview`}
            wide
            onClose={() => setPreview(false)}
          >
            <InvoiceDocument
              invoice={{
                ...sample,
                business: { ...business, name: business.name || 'Your business name' },
              }}
              template={value}
              sample
            />
          </Modal>,
          document.body,
        )}
    </>
  );
}
