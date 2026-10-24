import { useState } from 'react';
import type { Customer, Product, Invoice } from '../types';
import { useStore } from '../lib/store';
import { uid, today, money, balance } from '../lib/billing';
import { Field, StateSelect } from './ui';

export function CustomerForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Customer;
  onDone: (s: string) => void;
  onCancel: () => void;
}) {
  const { execute } = useStore();
  const [value, setValue] = useState<Customer>(
      initial || {
        id: uid(),
        name: '',
        type: 'B2C',
        email: '',
        phone: '',
        gstin: '',
        state: '08',
        address: '',
      },
    ),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const set = (key: keyof Customer, v: string) => setValue({ ...value, [key]: v });
  return (
    <form
      className="form-body"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await execute({ type: 'saveCustomer', customer: value });
          onDone('Customer saved.');
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="segmented">
        <button
          type="button"
          className={value.type === 'B2C' ? 'active' : ''}
          onClick={() => setValue({ ...value, type: 'B2C', gstin: '' })}
        >
          B2C · Consumer
        </button>
        <button
          type="button"
          className={value.type === 'B2B' ? 'active' : ''}
          onClick={() => set('type', 'B2B')}
        >
          B2B · Business
        </button>
      </div>
      <div className="form-grid">
        <Field label="Customer / business name *">
          <input
            required
            value={value.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Full name or registered business"
          />
        </Field>
        <Field label="Email">
          <input type="email" value={value.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Phone">
          <input type="tel" value={value.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="State *">
          <StateSelect value={value.state} onChange={(v) => set('state', v)} />
        </Field>
      </div>
      {value.type === 'B2B' && (
        <Field label="GSTIN *" hint="15-character GSTIN; state and checksum are validated.">
          <input
            required
            maxLength={15}
            value={value.gstin}
            onChange={(e) => set('gstin', e.target.value.toUpperCase())}
          />
        </Field>
      )}
      <Field label="Billing address *">
        <textarea
          required
          rows={3}
          value={value.address}
          onChange={(e) => set('address', e.target.value)}
          placeholder="Street, city, state and PIN code"
        />
      </Field>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save customer'}
        </button>
      </div>
    </form>
  );
}
export function ProductForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Product;
  onDone: (s: string) => void;
  onCancel: () => void;
}) {
  const { execute } = useStore();
  const [p, setP] = useState<Product>(
      initial || {
        id: uid(),
        name: '',
        sku: '',
        category: 'General',
        hsn: '',
        price: 0,
        cost: 0,
        gst: 18,
        stock: 0,
        lowStock: 10,
        unit: 'PCS',
        color: 'sage',
      },
    ),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const set = (k: keyof Product, v: string | number) => setP({ ...p, [k]: v });
  return (
    <form
      className="form-body"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await execute({ type: 'saveProduct', product: p });
          onDone('Product saved.');
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <Field label="Product name *">
          <input required value={p.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="SKU *">
          <input
            required
            value={p.sku}
            onChange={(e) => set('sku', e.target.value.toUpperCase())}
          />
        </Field>
        <Field label="Category">
          <input required value={p.category} onChange={(e) => set('category', e.target.value)} />
        </Field>
        <Field label="HSN / SAC *">
          <input
            required
            pattern="[0-9]{4,8}"
            value={p.hsn}
            onChange={(e) => set('hsn', e.target.value)}
          />
        </Field>
        <Field label="Selling price (excl. GST) ₹">
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={p.price}
            onChange={(e) => set('price', Number(e.target.value))}
          />
        </Field>
        <Field
          label={initial ? 'Average stock cost ₹' : 'Opening unit cost ₹'}
          hint="Enter cost excluding recoverable GST. Record later purchases through Adjust stock."
        >
          <input
            required
            type="number"
            step="0.01"
            min="0"
            disabled={Boolean(initial)}
            value={p.cost}
            onChange={(e) => set('cost', Number(e.target.value))}
          />
        </Field>
        <Field label="GST rate %" hint="Use the rate applicable to your product.">
          <input
            required
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={p.gst}
            onChange={(e) => set('gst', Number(e.target.value))}
          />
        </Field>
        <Field label="Unit">
          <select value={p.unit} onChange={(e) => set('unit', e.target.value)}>
            {['PCS', 'NOS', 'KGS', 'MTR', 'LTR', 'BOX', 'SET'].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </Field>
        {!initial && (
          <Field label="Opening stock">
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={p.stock}
              onChange={(e) => set('stock', Number(e.target.value))}
            />
          </Field>
        )}
        <Field label="Low stock alert at">
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={p.lowStock}
            onChange={(e) => set('lowStock', Number(e.target.value))}
          />
        </Field>
      </div>
      {initial && (
        <p className="form-hint">
          Use Adjust stock on the inventory page to record stock changes with a reason.
        </p>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save product'}
        </button>
      </div>
    </form>
  );
}
export function PaymentForm({
  invoice,
  onDone,
  onCancel,
}: {
  invoice?: Invoice;
  onDone: (s: string) => void;
  onCancel: () => void;
}) {
  const { data, execute } = useStore();
  const [paymentId] = useState(uid);
  const [id, setId] = useState(invoice?.id || ''),
    [amount, setAmount] = useState(invoice ? balance(invoice) : 0),
    [date, setDate] = useState(today()),
    [method, setMethod] = useState('UPI'),
    [reference, setReference] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const selected = data.invoices.find((i) => i.id === id);
  return (
    <form
      className="form-body"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!selected) return;
        setBusy(true);
        setError('');
        try {
          await execute({
            type: 'payment',
            payment: {
              id: paymentId,
              invoiceId: id,
              invoiceNumber: selected.number,
              customerName: selected.customer.name,
              amount,
              date,
              method,
              reference,
            },
          });
          onDone('Payment recorded. Invoice balance updated.');
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Invoice *">
        <select
          required
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setAmount(balance(data.invoices.find((i) => i.id === e.target.value)!));
          }}
        >
          <option value="" disabled>
            Select an unpaid invoice
          </option>
          {data.invoices
            .filter((i) => balance(i) > 0)
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.number} · {i.customer.name}
              </option>
            ))}
        </select>
      </Field>
      {selected && (
        <div className="payment-balance">
          <span>Outstanding balance</span>
          <strong>{money(balance(selected))}</strong>
        </div>
      )}
      <div className="form-grid">
        <Field label="Amount received ₹ *">
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            max={selected ? balance(selected) : undefined}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </Field>
        <Field label="Payment date *">
          <input
            required
            type="date"
            min={selected?.date}
            max={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Payment method">
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {['UPI', 'Bank transfer', 'Cash', 'Card', 'Cheque'].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Transaction reference">
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="UTR / transaction ID"
          />
        </Field>
      </div>
      <p className="form-hint">
        Record a payment you have already received. This does not charge the customer.
      </p>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary" disabled={busy || !selected}>
          {busy ? 'Saving…' : 'Record payment'}
        </button>
      </div>
    </form>
  );
}
export function StockForm({
  product,
  onDone,
  onCancel,
}: {
  product: Product;
  onDone: (s: string) => void;
  onCancel: () => void;
}) {
  const [purchaseId] = useState(uid);
  const [kind, setKind] = useState('purchase');
  const [unitCost, setUnitCost] = useState(product.cost);
  const [date, setDate] = useState(today());
  const { execute } = useStore();
  const [quantity, setQuantity] = useState(1),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="form-body"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          if (kind === 'purchase')
            await execute({
              type: 'purchase',
              purchase: {
                id: purchaseId,
                productId: product.id,
                quantity,
                unitCost,
                date,
                reference: reason,
              },
            });
          else await execute({ type: 'stock', id: product.id, quantity, reason });
          onDone(
            kind === 'purchase'
              ? 'Purchase received; average cost updated.'
              : 'Stock adjustment recorded.',
          );
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="payment-balance">
        <span>{product.name}</span>
        <strong>
          {product.stock} {product.unit}
        </strong>
      </div>
      <Field label="Stock entry type">
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="purchase">New purchase</option>
          <option value="adjustment">Stock correction</option>
        </select>
      </Field>
      {kind === 'purchase' && (
        <>
          <Field
            label="Purchase date"
            hint="Stock and cost update when recorded. Enter purchases before issuing related sales."
          >
            <input
              required
              type="date"
              max={today()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field
            label="Purchase unit cost ₹"
            hint="Exclude recoverable GST; include costs you cannot recover."
          >
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(Number(e.target.value))}
            />
          </Field>
          <p>
            Current average cost: {money(product.cost)} per {product.unit}. New purchases update the
            weighted average.
          </p>
        </>
      )}
      <Field
        label="Quantity change"
        hint="Use a positive number to add stock or a negative number to remove it."
      >
        <input
          required
          type="number"
          step="0.01"
          min={kind === 'purchase' ? 0.01 : -product.stock}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
      </Field>
      <Field label={kind === 'purchase' ? 'Supplier / bill reference *' : 'Reason *'}>
        <textarea
          required
          placeholder="e.g. New purchase received, stock count correction…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <p>
        New stock:{' '}
        <strong>
          {product.stock + quantity} {product.unit}
        </strong>
      </p>
      {error && <div className="error-banner">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save adjustment'}
        </button>
      </div>
    </form>
  );
}
