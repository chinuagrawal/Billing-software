import { useState } from 'react';
import {
  Plus,
  Download,
  ArrowUpRight,
  Pencil,
  SlidersHorizontal,
  Package,
  Users,
  Wallet,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { balance, csv, dateLabel, download, invoiceTotals, money, status } from '../lib/billing';
import { Avatar, Badge, Empty, ProductIcon, SearchBox, SectionTitle } from './ui';
import type { Customer, Invoice, Product } from '../types';
export function Invoices({
  onNew,
  onView,
  search,
  setSearch,
}: {
  onNew: () => void;
  onView: (i: Invoice) => void;
  search: string;
  setSearch: (s: string) => void;
}) {
  const { data } = useStore();
  const [filter, setFilter] = useState('All invoices'),
    [type, setType] = useState('All customers');
  const rows = data.invoices.filter(
    (i) =>
      `${i.number} ${i.customer.name} ${i.reference}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === 'All invoices' || status(i) === filter) &&
      (type === 'All customers' || i.customer.type === type),
  );
  const exportRows = () =>
    download(
      'sales-register.csv',
      csv([
        [
          'Invoice',
          'Date',
          'Customer',
          'Type',
          'GSTIN',
          'Place of supply',
          'Taxable',
          'CGST',
          'SGST/UTGST',
          'IGST',
          'Total',
          'Paid',
          'Balance',
          'Status',
        ],
        ...rows.map((i) => {
          const t = invoiceTotals(i);
          return [
            i.number,
            i.date,
            i.customer.name,
            i.customer.type,
            i.customer.gstin,
            i.placeOfSupply,
            t.taxable,
            t.cgst,
            t.sgst,
            t.igst,
            t.total,
            i.paid,
            balance(i),
            status(i),
          ];
        }),
      ]),
    );
  return (
    <>
      <SectionTitle
        title="Invoices"
        subtitle="Manage your B2B and B2C invoices in one place."
        action={
          <>
            <button className="button secondary" onClick={exportRows}>
              <Download size={16} />
              Export
            </button>
            <button className="button primary" onClick={onNew}>
              <Plus size={17} />
              Create invoice
            </button>
          </>
        }
      />
      <div className="summary-row">
        <div>
          <span>Total invoiced</span>
          <strong>
            {money(
              data.invoices
                .filter((i) => i.status === 'issued')
                .reduce((s, i) => s + invoiceTotals(i).total, 0),
            )}
          </strong>
        </div>
        <div>
          <span>Outstanding balance</span>
          <strong>{money(data.invoices.reduce((s, i) => s + balance(i), 0))}</strong>
        </div>
        <div>
          <span>Draft invoices</span>
          <strong>{data.invoices.filter((i) => i.status === 'draft').length}</strong>
        </div>
      </div>
      <section className="panel">
        <div className="tabs">
          {['All invoices', 'Paid', 'Unpaid', 'Partially paid', 'Overdue', 'Draft', 'Void'].map(
            (f) => (
              <button className={filter === f ? 'active' : ''} key={f} onClick={() => setFilter(f)}>
                {f}
                <span>
                  {data.invoices.filter((i) => f === 'All invoices' || status(i) === f).length}
                </span>
              </button>
            ),
          )}
        </div>
        <div className="table-controls">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search invoice, customer or reference…"
          />
          <select
            aria-label="Filter customer type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {['All customers', 'B2B', 'B2C'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Date / Due</th>
                <th>Total</th>
                <th>Balance</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td>
                    <button className="invoice-link" onClick={() => onView(i)}>
                      {i.number}
                    </button>
                    <small>{i.reference || 'Direct invoice'}</small>
                  </td>
                  <td>
                    <div className="person-cell">
                      <Avatar name={i.customer.name} small />
                      <div>
                        <strong>{i.customer.name}</strong>
                        <span>{i.customer.type}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {dateLabel(i.date)}
                    <small>Due {dateLabel(i.dueDate)}</small>
                  </td>
                  <td className="amount">{money(invoiceTotals(i).total)}</td>
                  <td className="amount">{money(balance(i))}</td>
                  <td>
                    <Badge value={status(i)} />
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Open ${i.number}`}
                      onClick={() => onView(i)}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <Empty
              title="No invoices found"
              text="Try a different filter, or create a new invoice."
              action={
                <button className="button primary" onClick={onNew}>
                  Create invoice
                </button>
              }
            />
          )}
        </div>
        <div className="table-footer">
          <span>{rows.length} invoices</span>
          <span>Amounts include GST · INR</span>
        </div>
      </section>
    </>
  );
}
export function Customers({
  onEdit,
  search,
  setSearch,
}: {
  onEdit: (c?: Customer) => void;
  search: string;
  setSearch: (s: string) => void;
}) {
  const { data } = useStore();
  const [type, setType] = useState('All');
  const rows = data.customers.filter(
    (c) =>
      `${c.name} ${c.email} ${c.gstin} ${c.phone}`.toLowerCase().includes(search.toLowerCase()) &&
      (type === 'All' || c.type === type),
  );
  return (
    <>
      <SectionTitle
        title="Customers"
        subtitle="Good business starts with great relationships."
        action={
          <button className="button primary" onClick={() => onEdit()}>
            <Plus size={17} />
            Add customer
          </button>
        }
      />
      <div className="summary-row">
        <div>
          <span>
            <Users size={15} />
            All customers
          </span>
          <strong>{data.customers.length}</strong>
        </div>
        <div>
          <span>Business customers · B2B</span>
          <strong>{data.customers.filter((c) => c.type === 'B2B').length}</strong>
        </div>
        <div>
          <span>Consumers · B2C</span>
          <strong>{data.customers.filter((c) => c.type === 'B2C').length}</strong>
        </div>
      </div>
      <section className="panel">
        <div className="table-controls">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search customers, email or GSTIN…"
          />
          <select aria-label="Customer type" value={type} onChange={(e) => setType(e.target.value)}>
            {['All', 'B2B', 'B2C'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>GSTIN</th>
                <th>Total sales</th>
                <th>Outstanding</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const invoices = data.invoices.filter(
                  (i) => i.customer.id === c.id && i.status === 'issued',
                );
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="person-cell">
                        <Avatar name={c.name} />
                        <div>
                          <strong>{c.name}</strong>
                          <span>
                            {c.type} · {invoices.length} invoices
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {c.email || '—'}
                      <small>{c.phone || 'No phone added'}</small>
                    </td>
                    <td className="mono">
                      {c.gstin || <span className="muted">Unregistered</span>}
                    </td>
                    <td className="amount">
                      {money(invoices.reduce((s, i) => s + invoiceTotals(i).total, 0))}
                    </td>
                    <td className="amount">
                      {money(invoices.reduce((s, i) => s + balance(i), 0))}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Edit ${c.name}`}
                        onClick={() => onEdit(c)}
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && (
            <Empty
              title="Meet your next customer"
              text="Add your B2B and B2C customers to start billing."
            />
          )}
        </div>
        <div className="table-footer">{rows.length} customers</div>
      </section>
    </>
  );
}
export function Inventory({
  onEdit,
  onStock,
  search,
  setSearch,
}: {
  onEdit: (p?: Product) => void;
  onStock: (p: Product) => void;
  search: string;
  setSearch: (s: string) => void;
}) {
  const { data } = useStore();
  const [filter, setFilter] = useState('All products');
  const rows = data.products.filter(
    (p) =>
      `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'All products' || p.stock <= p.lowStock),
  );
  return (
    <>
      <SectionTitle
        title="Inventory"
        subtitle="Know what’s in stock. Be ready for what’s next."
        action={
          <>
            <button
              className="button secondary"
              onClick={() =>
                download(
                  'inventory.csv',
                  csv([
                    [
                      'Product',
                      'SKU',
                      'HSN',
                      'Category',
                      'Price',
                      'Cost',
                      'GST %',
                      'Stock',
                      'Unit',
                    ],
                    ...rows.map((p) => [
                      p.name,
                      p.sku,
                      p.hsn,
                      p.category,
                      p.price,
                      p.cost,
                      p.gst,
                      p.stock,
                      p.unit,
                    ]),
                  ]),
                )
              }
            >
              <Download size={16} />
              Export
            </button>
            <button className="button primary" onClick={() => onEdit()}>
              <Plus size={17} />
              Add product
            </button>
          </>
        }
      />
      <div className="summary-row">
        <div>
          <span>
            <Package size={15} />
            Products
          </span>
          <strong>{data.products.length}</strong>
        </div>
        <div>
          <span>Inventory value · at cost</span>
          <strong>{money(data.products.reduce((s, p) => s + p.cost * p.stock, 0))}</strong>
        </div>
        <div>
          <span>Low stock products</span>
          <strong>{data.products.filter((p) => p.stock <= p.lowStock).length}</strong>
        </div>
      </div>
      <section className="panel">
        <div className="table-controls">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search product, SKU or category…"
          />
          <select
            aria-label="Stock filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option>All products</option>
            <option>Low stock</option>
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>HSN / GST</th>
                <th>Selling price</th>
                <th>Available stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="person-cell">
                      <ProductIcon color={p.color} />
                      <div>
                        <strong>{p.name}</strong>
                        <span>{p.sku}</span>
                      </div>
                    </div>
                  </td>
                  <td>{p.category}</td>
                  <td>
                    {p.hsn}
                    <small>{p.gst}% GST</small>
                  </td>
                  <td className="amount">
                    {money(p.price)}
                    <small>excl. GST</small>
                  </td>
                  <td>
                    <strong>{p.stock}</strong> <span className="muted">{p.unit}</span>
                  </td>
                  <td>
                    <Badge
                      value={
                        p.stock === 0
                          ? 'Out of stock'
                          : p.stock <= p.lowStock
                            ? 'Low stock'
                            : 'In stock'
                      }
                    />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        aria-label={`Adjust stock for ${p.name}`}
                        title="Adjust stock"
                        onClick={() => onStock(p)}
                      >
                        <SlidersHorizontal size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Edit ${p.name}`}
                        onClick={() => onEdit(p)}
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <Empty
              title="Your shelves are ready"
              text="Add products to start managing your inventory."
            />
          )}
        </div>
        <div className="table-footer">
          <span>{rows.length} products</span>
          <span>Stock updates automatically when invoices are issued</span>
        </div>
      </section>
    </>
  );
}
export function Payments({
  onNew,
  search,
  setSearch,
}: {
  onNew: () => void;
  search: string;
  setSearch: (s: string) => void;
}) {
  const { data } = useStore();
  const rows = data.payments.filter((p) =>
    `${p.customerName} ${p.invoiceNumber} ${p.reference}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <SectionTitle
        title="Payments"
        subtitle="Every rupee, accounted for. Keep your cash flow moving."
        action={
          <>
            <button
              className="button secondary"
              onClick={() =>
                download(
                  'payments.csv',
                  csv([
                    ['Date', 'Invoice', 'Customer', 'Method', 'Reference', 'Amount'],
                    ...rows.map((p) => [
                      p.date,
                      p.invoiceNumber,
                      p.customerName,
                      p.method,
                      p.reference,
                      p.amount,
                    ]),
                  ]),
                )
              }
            >
              <Download size={16} />
              Export
            </button>
            <button className="button primary" onClick={onNew}>
              <Plus size={17} />
              Record payment
            </button>
          </>
        }
      />
      <div className="summary-row">
        <div>
          <span>
            <Wallet size={15} />
            Total received
          </span>
          <strong>{money(data.payments.reduce((s, p) => s + p.amount, 0))}</strong>
        </div>
        <div>
          <span>Payment entries</span>
          <strong>{data.payments.length}</strong>
        </div>
        <div>
          <span>Awaiting payment</span>
          <strong>{money(data.invoices.reduce((s, i) => s + balance(i), 0))}</strong>
        </div>
      </div>
      <section className="panel">
        <div className="table-controls">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search payment, customer or reference…"
          />
          <span className="muted">Recorded receipts</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Invoice</th>
                <th>Date</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="person-cell">
                      <Avatar name={p.customerName} small />
                      <strong>{p.customerName}</strong>
                    </div>
                  </td>
                  <td>{p.invoiceNumber}</td>
                  <td>{dateLabel(p.date)}</td>
                  <td>{p.method}</td>
                  <td className="mono">{p.reference || '—'}</td>
                  <td className="amount">{money(p.amount)}</td>
                  <td>
                    <Badge value="Received" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <Empty
              title="Make room for good news"
              text="Record a customer payment to start your receipts ledger."
            />
          )}
        </div>
        <div className="table-footer">{rows.length} payments</div>
      </section>
    </>
  );
}
