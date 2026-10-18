import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  Wallet,
  BarChart3,
  Settings as SettingsIcon,
  ChevronDown,
  Search,
  Bell,
  Plus,
  PanelLeftClose,
  Menu,
  CircleHelp,
  ArrowUpRight,
  CheckCircle2,
  X,
  Command as CommandIcon,
  Cloud,
  LogOut,
} from 'lucide-react';
import type { Customer, Invoice, Product } from './types';
import { useStore } from './lib/store';
import { status } from './lib/billing';
import { Modal, Avatar } from './components/ui';
import { Dashboard } from './components/Dashboard';
import { Customers, Inventory, Invoices, Payments } from './components/Records';
import { Reports } from './components/Reports';
import { AuthForm, Settings } from './components/Settings';
import { InvoiceEditor } from './components/InvoiceEditor';
import { InvoiceView } from './components/InvoiceView';
import { CustomerForm, ProductForm, PaymentForm, StockForm } from './components/Forms';
type Dialog =
  | { type: 'invoice'; invoice?: Invoice }
  | { type: 'view'; invoice: Invoice }
  | { type: 'customer'; customer?: Customer }
  | { type: 'product'; product?: Product }
  | { type: 'payment'; invoice?: Invoice }
  | { type: 'stock'; product: Product }
  | { type: 'auth' }
  | { type: 'help' }
  | null;
const nav = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Invoices', icon: FileText },
  { name: 'Customers', icon: Users },
  { name: 'Inventory', icon: Package },
  { name: 'Payments', icon: Wallet },
  { name: 'Reports', icon: BarChart3 },
];
const pages = [...nav.map((n) => n.name), 'Settings'];
export default function App() {
  const { data, mode, user, loading, error, logout } = useStore();
  const initial = decodeURIComponent(location.hash.slice(1));
  const [page, setPage] = useState(pages.includes(initial) ? initial : 'Overview'),
    [search, setSearch] = useState(''),
    [globalSearch, setGlobalSearch] = useState(''),
    [dialog, setDialog] = useState<Dialog>(null),
    [toast, setToast] = useState(''),
    [mobile, setMobile] = useState(false),
    [notifications, setNotifications] = useState(false),
    [profile, setProfile] = useState(false);
  const close = useCallback(() => setDialog(null), []);
  function navigate(p: string) {
    setPage(p);
    location.hash = p;
    setSearch('');
    setGlobalSearch('');
    setMobile(false);
    setNotifications(false);
    setProfile(false);
  }
  const notify = (s: string) => setToast(s);
  const done = (s: string) => {
    setDialog(null);
    notify(s);
  };
  const createInvoice = () => setDialog({ type: 'invoice' });
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const hash = () => {
      const p = decodeURIComponent(location.hash.slice(1));
      if (pages.includes(p)) setPage(p);
    };
    window.addEventListener('hashchange', hash);
    return () => window.removeEventListener('hashchange', hash);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const overdue = data.invoices.filter((i) => status(i) === 'Overdue'),
    low = data.products.filter((p) => p.stock <= p.lowStock),
    alertCount = overdue.length + low.length;
  const results = globalSearch.trim()
    ? data.invoices
        .filter((i) =>
          `${i.number} ${i.customer.name} ${i.reference}`
            .toLowerCase()
            .includes(globalSearch.toLowerCase()),
        )
        .slice(0, 5)
    : [];
  const selectedInvoice =
    dialog?.type === 'view'
      ? data.invoices.find((i) => i.id === dialog.invoice.id) || dialog.invoice
      : null;
  return (
    <div className="app-shell">
      {mobile && <div className="sidebar-scrim" onClick={() => setMobile(false)} />}
      <aside className={`sidebar ${mobile ? 'sidebar-open' : ''}`}>
        <a href="#Overview" className="brand" onClick={() => navigate('Overview')}>
          <span className="brand-mark">
            a<span>e</span>
          </span>
          <div>
            <strong>
              agrawal<span> enterprises</span>
            </strong>
            <small>BUSINESS, BEAUTIFULLY BALANCED</small>
          </div>
        </a>
        <button className="workspace-switch" onClick={() => navigate('Settings')}>
          <span className="workspace-monogram">AE</span>
          <div>
            <strong>{data.business.name}</strong>
            <span>Rajasthan, India</span>
          </div>
          <ChevronDown size={14} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.name}
              className={`nav-item ${page === n.name ? 'active' : ''}`}
              onClick={() => navigate(n.name)}
            >
              <n.icon size={19} strokeWidth={1.7} />
              <span>{n.name}</span>
              {n.name === 'Invoices' && <b>{data.invoices.length}</b>}
              {n.name === 'Inventory' && low.length > 0 && <i className="nav-alert" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-star">✧</span>
            <h4>Room to grow.</h4>
            <p>
              Big plans start with
              <br />a well-run business.
            </p>
            <button onClick={() => navigate('Reports')}>
              See your insights <ArrowUpRight size={14} />
            </button>
            <span className="note-art">↗</span>
          </div>
          <button
            className={`nav-item ${page === 'Settings' ? 'active' : ''}`}
            onClick={() => navigate('Settings')}
          >
            <SettingsIcon size={19} />
            <span>Settings</span>
          </button>
          <button className="nav-item" onClick={() => setDialog({ type: 'help' })}>
            <CircleHelp size={19} />
            <span>Help & getting started</span>
            <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-user">
            <Avatar name={user?.email || 'Agrawal Enterprises'} />
            <div>
              <strong>{user?.email?.split('@')[0] || 'Agrawal Enterprises'}</strong>
              <span>{mode === 'demo' ? 'Demo workspace' : 'Workspace owner'}</span>
            </div>
            <button
              aria-label="Account settings"
              className="icon-button"
              onClick={() => navigate('Settings')}
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="Open menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>{page}</strong>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={16} />
              <input
                id="global-search"
                placeholder="Search invoices…"
                aria-label="Search all invoices"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
              <kbd>
                <CommandIcon size={11} /> K
              </kbd>
              {globalSearch && (
                <div className="search-results">
                  {results.length ? (
                    results.map((i) => (
                      <button
                        key={i.id}
                        onClick={() => {
                          setDialog({ type: 'view', invoice: i });
                          setGlobalSearch('');
                        }}
                      >
                        <FileText size={16} />
                        <div>
                          <strong>{i.customer.name}</strong>
                          <small>{i.number}</small>
                        </div>
                        <ArrowUpRight size={15} />
                      </button>
                    ))
                  ) : (
                    <p>No matching invoices</p>
                  )}
                </div>
              )}
            </div>
            <div className="topbar-divider" />
            <div className="popover-parent">
              <button
                className="icon-button notification-button"
                aria-label="Notifications"
                onClick={() => {
                  setNotifications(!notifications);
                  setProfile(false);
                }}
              >
                <Bell size={19} />
                {alertCount > 0 && <i />}
              </button>
              {notifications && (
                <div className="notifications-popover">
                  <h3>
                    Business reminders <span>{alertCount}</span>
                  </h3>
                  <button onClick={() => navigate('Invoices')}>
                    <FileText size={18} />
                    <div>
                      <strong>{overdue.length} invoices are overdue</strong>
                      <small>Review outstanding customer balances</small>
                    </div>
                    <ArrowUpRight size={16} />
                  </button>
                  <button onClick={() => navigate('Inventory')}>
                    <Package size={18} />
                    <div>
                      <strong>{low.length} products running low</strong>
                      <small>Keep your shelves ready for the next sale</small>
                    </div>
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              )}
            </div>
            <div className="popover-parent">
              <button
                className="profile-button"
                aria-label="Account menu"
                onClick={() => {
                  setProfile(!profile);
                  setNotifications(false);
                }}
              >
                <Avatar name="Agrawal Enterprises" small />
                <ChevronDown size={13} />
              </button>
              {profile && (
                <div className="account-popover">
                  <strong>{user?.email || 'Agrawal Enterprises'}</strong>
                  <small>{mode === 'demo' ? 'You’re in demo mode' : 'Cloud workspace owner'}</small>
                  <button
                    onClick={() => {
                      setDialog({ type: 'auth' });
                      setProfile(false);
                    }}
                  >
                    <Cloud size={16} />
                    {mode === 'demo' ? 'Connect cloud account' : 'Account connection'}
                  </button>
                  {user && (
                    <button
                      onClick={() => {
                        void logout();
                        setProfile(false);
                      }}
                    >
                      <LogOut size={16} />
                      Sign out
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        <main>
          {error && (
            <div className="error-banner" role="alert">
              Cloud connection error: {error}. Check your Firebase configuration and security rules
              before making changes.
            </div>
          )}
          {loading ? (
            <div className="loading-screen">
              <span className="spinner" />
              <h3>Opening your workspace…</h3>
            </div>
          ) : (
            <>
              {page === 'Overview' && (
                <Dashboard
                  navigate={navigate}
                  newInvoice={createInvoice}
                  viewInvoice={(invoice) => setDialog({ type: 'view', invoice })}
                />
              )}
              {page === 'Invoices' && (
                <Invoices
                  onNew={createInvoice}
                  onView={(invoice) => setDialog({ type: 'view', invoice })}
                  search={search}
                  setSearch={setSearch}
                />
              )}
              {page === 'Customers' && (
                <Customers
                  onEdit={(customer) => setDialog({ type: 'customer', customer })}
                  search={search}
                  setSearch={setSearch}
                />
              )}
              {page === 'Inventory' && (
                <Inventory
                  onEdit={(product) => setDialog({ type: 'product', product })}
                  onStock={(product) => setDialog({ type: 'stock', product })}
                  search={search}
                  setSearch={setSearch}
                />
              )}
              {page === 'Payments' && (
                <Payments
                  onNew={() => setDialog({ type: 'payment' })}
                  search={search}
                  setSearch={setSearch}
                />
              )}
              {page === 'Reports' && <Reports />}
              {page === 'Settings' && (
                <Settings
                  key={mode}
                  notify={notify}
                  onConnect={() => setDialog({ type: 'auth' })}
                />
              )}
            </>
          )}
        </main>
      </div>
      {dialog && (
        <Modal
          title={
            dialog.type === 'invoice'
              ? dialog.invoice
                ? 'Edit draft'
                : 'Create invoice'
              : dialog.type === 'view'
                ? selectedInvoice?.number || 'Invoice'
                : dialog.type === 'customer'
                  ? dialog.customer
                    ? 'Edit customer'
                    : 'Add customer'
                  : dialog.type === 'product'
                    ? dialog.product
                      ? 'Edit product'
                      : 'Add product'
                    : dialog.type === 'payment'
                      ? 'Record payment'
                      : dialog.type === 'stock'
                        ? 'Adjust stock'
                        : dialog.type === 'auth'
                          ? 'Connect your workspace'
                          : 'A good place to start'
          }
          subtitle={
            dialog.type === 'invoice'
              ? 'A thoughtful invoice. A great first impression.'
              : undefined
          }
          wide={dialog.type === 'invoice' || dialog.type === 'view'}
          onClose={close}
        >
          {dialog.type === 'invoice' && (
            <InvoiceEditor initial={dialog.invoice} onDone={done} onCancel={close} />
          )}
          {dialog.type === 'view' && selectedInvoice && (
            <InvoiceView
              invoice={selectedInvoice}
              onEdit={() => setDialog({ type: 'invoice', invoice: selectedInvoice })}
              onPay={() => setDialog({ type: 'payment', invoice: selectedInvoice })}
              onDone={done}
            />
          )}
          {dialog.type === 'customer' && (
            <CustomerForm initial={dialog.customer} onDone={done} onCancel={close} />
          )}
          {dialog.type === 'product' && (
            <ProductForm initial={dialog.product} onDone={done} onCancel={close} />
          )}
          {dialog.type === 'payment' && (
            <PaymentForm invoice={dialog.invoice} onDone={done} onCancel={close} />
          )}
          {dialog.type === 'stock' && (
            <StockForm product={dialog.product} onDone={done} onCancel={close} />
          )}
          {dialog.type === 'auth' && <AuthForm onDone={close} />}
          {dialog.type === 'help' && (
            <div className="form-body help-body">
              <p>Your everyday billing, in a few simple steps.</p>
              {[
                {
                  title: 'Make it yours',
                  text: 'Add your GSTIN, registered address and bank details in Settings.',
                  page: 'Settings',
                },
                {
                  title: 'Meet your customers',
                  text: 'Add consumers as B2C or GST-registered businesses as B2B.',
                  page: 'Customers',
                },
                {
                  title: 'Stock your shelves',
                  text: 'Add products, HSN codes, prices, tax rates and opening stock.',
                  page: 'Inventory',
                },
                {
                  title: 'Send your first invoice',
                  text: 'Create a draft, review it, then issue and print or save as PDF.',
                  page: 'Invoices',
                },
                {
                  title: 'Keep the books moving',
                  text: 'Record received payments and export your GST sales register.',
                  page: 'Reports',
                },
              ].map((step, n) => (
                <button
                  key={step.title}
                  onClick={() => {
                    navigate(step.page);
                    close();
                  }}
                >
                  <span>{n + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                  <ArrowUpRight size={18} />
                </button>
              ))}
              <div className="info-banner">
                Sales channels are labels for tracking manually entered orders. Marketplace sync,
                online payment collection, GST filing and e-invoicing require additional
                integrations.
              </div>
            </div>
          )}
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{toast}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
      <button className="mobile-create" aria-label="Create invoice" onClick={createInvoice}>
        <Plus size={24} />
      </button>
    </div>
  );
}
