export type CustomerType = 'B2B' | 'B2C';
export type InvoiceTemplate = 'classic' | 'modern' | 'minimal';
export interface Business {
  invoiceTemplate?: InvoiceTemplate;
  setupCompleted?: boolean;
  name: string;
  gstin: string;
  state: string;
  address: string;
  email: string;
  phone: string;
  bankName: string;
  account: string;
  ifsc: string;
  upi: string;
  terms: string;
  prefix: string;
}
export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  email: string;
  phone: string;
  gstin: string;
  state: string;
  address: string;
}
export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  hsn: string;
  price: number;
  cost: number;
  gst: number;
  stock: number;
  lowStock: number;
  unit: string;
  color: string;
}
export interface Purchase {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  date: string;
  reference: string;
}
export interface LineItem {
  costTotal?: number;
  productId: string;
  name: string;
  hsn: string;
  unit: string;
  qty: number;
  price: number;
  discount: number;
  gst: number;
}
export interface Invoice {
  roundOff?: number;
  id: string;
  number: string;
  customer: Customer;
  business: Business;
  date: string;
  dueDate: string;
  placeOfSupply: string;
  shippingAddress: string;
  reference: string;
  items: LineItem[];
  notes: string;
  status: 'draft' | 'issued' | 'void';
  paid: number;
  createdAt: string;
}
export interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  date: string;
  method: string;
  reference: string;
}
export interface Audit {
  id: string;
  action: string;
  detail: string;
  at: string;
}
export interface Workspace {
  purchases?: Purchase[];
  business: Business;
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  payments: Payment[];
  audit: Audit[];
  counters: Record<string, number>;
}
export type Command =
  | { type: 'purchase'; purchase: Purchase }
  | { type: 'saveCustomer'; customer: Customer }
  | { type: 'saveProduct'; product: Product }
  | { type: 'saveBusiness'; business: Business }
  | { type: 'saveInvoice'; invoice: Invoice; issue: boolean }
  | { type: 'payment'; payment: Payment }
  | { type: 'void'; id: string }
  | { type: 'deleteDraft'; id: string }
  | { type: 'stock'; id: string; quantity: number; reason: string };
