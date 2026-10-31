import { useState } from 'react';
import { Plus, Trash2, FileCheck2, Save, Info } from 'lucide-react';
import type { Invoice, LineItem } from '../types';
import { useStore } from '../lib/store';
import { dateLabel, money, totals, today, uid } from '../lib/billing';
import { Field, StateSelect } from './ui';

export function InvoiceEditor({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Invoice;
  onDone: (text: string) => void;
  onCancel: () => void;
}) {
  const { data, execute } = useStore();
  const [invoiceId] = useState(() => initial?.id || uid());
  const [createdAt] = useState(() => initial?.createdAt || new Date().toISOString());
  const [customerId, setCustomerId] = useState(initial?.customer.id || '');
  const [date, setDate] = useState(initial?.date || today()),
    [dueDate, setDueDate] = useState(initial?.dueDate || today()),
    [place, setPlace] = useState(initial?.placeOfSupply || data.business.state);
  const [reference, setReference] = useState(initial?.reference || ''),
    [shipping, setShipping] = useState(initial?.shippingAddress || ''),
    [notes, setNotes] = useState(initial?.notes || '');
  const [items, setItems] = useState<LineItem[]>(initial?.items || []),
    [product, setProduct] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const customer = data.customers.find((c) => c.id === customerId),
    sum = totals(items, place !== data.business.state);
  const update = (index: number, key: keyof LineItem, value: string | number) =>
    setItems(items.map((item, n) => (n === index ? { ...item, [key]: value } : item)));
  const add = () => {
    const p = data.products.find((p) => p.id === product);
    if (!p) return;
    setItems([
      ...items,
      {
        productId: p.id,
        name: p.name,
        hsn: p.hsn,
        unit: p.unit,
        qty: 1,
        price: p.price,
        gst: p.gst,
        discount: 0,
      },
    ]);
    setProduct('');
  };
  async function save(issue: boolean) {
    setError('');
    if (!customer) {
      setError('Select a customer before saving.');
      return;
    }
    setBusy(true);
    try {
      await execute({
        type: 'saveInvoice',
        issue,
        invoice: {
          id: invoiceId,
          number: 'DRAFT',
          customer: { ...customer },
          business: { ...data.business },
          date,
          dueDate,
          placeOfSupply: place,
          shippingAddress: shipping || customer.address,
          reference,
          items,
          notes,
          status: 'draft',
          paid: 0,
          createdAt,
        },
      });
      onDone(
        issue
          ? 'Invoice issued and inventory updated.'
          : 'Draft saved. You can come back to it anytime.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="editor-body">
      <div className="editor-intro">
        <span className="document-icon">
          <FileCheck2 size={22} />
        </span>
        <div>
          <strong>{data.business.name}</strong>
          <p>Tax invoice · {initial?.number || 'Number assigned when issued'}</p>
        </div>
        <span className="tiny-tag">INR ₹</span>
      </div>
      {data.customers.length === 0 || data.products.length === 0 ? (
        <div className="info-banner">
          <Info size={18} />
          Add at least one customer and product before creating your first invoice.
        </div>
      ) : null}
      <div className="form-grid three">
        <Field label="Bill to *">
          <select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              const c = data.customers.find((c) => c.id === e.target.value);
              if (c) {
                setPlace(c.state);
                setShipping(c.address);
              }
            }}
          >
            <option value="">Select customer</option>
            {data.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.type}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Invoice date *">
          <input
            type="date"
            max={today()}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              if (dueDate < e.target.value) setDueDate(e.target.value);
            }}
          />
        </Field>
        <Field label="Due date *">
          <input
            type="date"
            min={date}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
        <Field label="Place of supply *">
          <StateSelect value={place} onChange={setPlace} />
        </Field>
        <Field label="Reference number">
          <input
            placeholder="e.g. PO-1001"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>
      </div>
      {customer && (
        <div className="customer-preview">
          <strong>{customer.type} customer</strong>
          <span>{customer.gstin || 'Unregistered consumer'}</span>
          <span>
            {customer.address || 'Billing address missing — update the customer before issuing.'}
          </span>
        </div>
      )}
      <div className="items-heading">
        <h3>Invoice items</h3>
        <span>Unit rates shown before discount</span>
      </div>
      <div className="add-product-row">
        <select
          aria-label="Select product"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
        >
          <option value="">Choose a product to add…</option>
          {data.products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {money(p.price)} excl. GST · {p.gst}% GST ·{' '}
              {money(
                totals(
                  [
                    {
                      productId: p.id,
                      name: p.name,
                      hsn: p.hsn,
                      unit: p.unit,
                      qty: 1,
                      price: p.price,
                      gst: p.gst,
                      discount: 0,
                    },
                  ],
                  place !== data.business.state,
                ).total,
              )}{' '}
              incl. GST · {p.stock} in stock
            </option>
          ))}
        </select>
        <button className="button secondary" disabled={!product} onClick={add}>
          <Plus size={16} />
          Add item
        </button>
      </div>
      <div className="table-scroll editor-table">
        <table>
          <thead>
            <tr>
              <th>Item / HSN</th>
              <th>Qty</th>
              <th>Rate excl. GST ₹</th>
              <th>Rate incl. GST</th>
              <th>Disc. %</th>
              <th>GST %</th>
              <th>Amount incl. GST</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td>
                  <strong>{item.name}</strong>
                  <small>
                    {item.hsn} · {item.unit}
                  </small>
                </td>
                <td>
                  <input
                    aria-label={`Quantity for ${item.name}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.qty}
                    onChange={(e) => update(index, 'qty', Number(e.target.value))}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Price for ${item.name}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => update(index, 'price', Number(e.target.value))}
                  />
                </td>
                <td className="amount gst-inclusive-rate">
                  <strong>
                    {money(
                      totals([{ ...item, qty: 1, discount: 0 }], place !== data.business.state)
                        .total,
                    )}
                  </strong>
                  <small>per {item.unit}</small>
                </td>
                <td>
                  <input
                    aria-label={`Discount for ${item.name}`}
                    type="number"
                    min="0"
                    max="100"
                    value={item.discount}
                    onChange={(e) => update(index, 'discount', Number(e.target.value))}
                  />
                </td>
                <td>
                  <input
                    aria-label={`GST for ${item.name}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={item.gst}
                    onChange={(e) => update(index, 'gst', Number(e.target.value))}
                  />
                </td>
                <td className="amount">
                  {money(totals([item], place !== data.business.state).total)}
                </td>
                <td>
                  <button
                    className="icon-button danger-text"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => setItems(items.filter((_, n) => n !== index))}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <div className="items-empty">Add products above to start building your invoice.</div>
        )}
      </div>
      {items.length > 0 && (
        <p className="form-hint">
          Unit rates are before discount. Each line amount includes GST after discount and line
          rounding.
        </p>
      )}
      <div className="invoice-bottom">
        <div className="invoice-notes">
          <Field label="Delivery address">
            <textarea
              rows={2}
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
              placeholder="Same as billing address"
            />
          </Field>
          <Field label="Notes for your customer">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a delivery note or payment instruction…"
            />
          </Field>
          <p className="form-hint">
            <Info size={14} />
            Issuing an invoice reserves its number and deducts stock. Issued invoices are locked.
          </p>
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
          {place !== data.business.state ? (
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
                <span>{['04', '26', '31', '35', '38'].includes(place) ? 'UTGST' : 'SGST'}</span>
                <strong>{money(sum.sgst)}</strong>
              </div>
            </>
          )}
          <div className="grand-total">
            <span>Total amount</span>
            <strong>{money(sum.total)}</strong>
          </div>
          <small>Due on {dueDate ? dateLabel(dueDate) : '—'}</small>
        </div>
      </div>
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button className="button secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <div>
          <button className="button secondary" disabled={busy} onClick={() => save(false)}>
            <Save size={16} />
            Save draft
          </button>
          <button className="button primary" disabled={busy} onClick={() => save(true)}>
            <FileCheck2 size={16} />
            {busy ? 'Saving…' : 'Issue invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
