import type { Business, Customer, Product, Workspace, Invoice } from '../types';
import { today, invoiceTotals, fy } from './billing';

export const defaultBusiness: Business = {
  name: 'Agrawal Enterprises',
  gstin: '',
  state: '08',
  address: '',
  email: '',
  phone: '',
  bankName: '',
  account: '',
  ifsc: '',
  upi: '',
  terms:
    'Thank you for your business. Please include your invoice number in the payment reference.',
  prefix: 'AE',
};
export const emptyWorkspace = (): Workspace => ({
  business: { ...defaultBusiness },
  customers: [],
  products: [],
  invoices: [],
  payments: [],
  audit: [],
  counters: {},
});
const offset = (days: number) => {
  const d = new Date(`${today()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export function demoWorkspace(): Workspace {
  const business = {
    ...defaultBusiness,
    address: 'Johari Bazaar, Jaipur, Rajasthan 302003',
    email: 'accounts@example.com',
    phone: '+91 98765 43210',
  };
  const customers: Customer[] = [
    {
      id: 'c1',
      name: 'Urban Living Co.',
      type: 'B2B',
      email: 'purchasing@example.com',
      phone: '9876500001',
      gstin: '27AAPFU0939F1ZV',
      state: '27',
      address: 'Andheri East, Mumbai, Maharashtra 400069',
    },
    {
      id: 'c2',
      name: 'Priya Sharma',
      type: 'B2C',
      email: 'priya@example.com',
      phone: '9876500002',
      gstin: '',
      state: '08',
      address: 'Vaishali Nagar, Jaipur, Rajasthan 302021',
    },
    {
      id: 'c3',
      name: 'The Modern Store',
      type: 'B2B',
      email: 'orders@example.com',
      phone: '9876500003',
      gstin: '07AAACB2894G1ZJ',
      state: '07',
      address: 'Connaught Place, New Delhi 110001',
    },
    {
      id: 'c4',
      name: 'Rahul Mehta',
      type: 'B2C',
      email: 'rahul@example.com',
      phone: '9876500004',
      gstin: '',
      state: '29',
      address: 'Indiranagar, Bengaluru, Karnataka 560038',
    },
    {
      id: 'c5',
      name: 'Ananya Gupta',
      type: 'B2C',
      email: 'ananya@example.com',
      phone: '9876500005',
      gstin: '',
      state: '08',
      address: 'C-Scheme, Jaipur, Rajasthan 302001',
    },
    {
      id: 'c6',
      name: 'Karan Malhotra',
      type: 'B2C',
      email: 'karan@example.com',
      phone: '9876500006',
      gstin: '',
      state: '06',
      address: 'Sector 29, Gurugram, Haryana 122001',
    },
  ];
  const products: Product[] = [
    {
      id: 'p1',
      name: 'Everyday Canvas Tote',
      sku: 'AE-BG-001',
      category: 'Accessories',
      hsn: '420222',
      price: 749,
      cost: 320,
      gst: 18,
      stock: 142,
      lowStock: 20,
      unit: 'PCS',
      color: 'sand',
    },
    {
      id: 'p2',
      name: 'Ceramic Coffee Mug',
      sku: 'AE-HM-002',
      category: 'Home & Living',
      hsn: '691200',
      price: 499,
      cost: 190,
      gst: 12,
      stock: 86,
      lowStock: 15,
      unit: 'PCS',
      color: 'peach',
    },
    {
      id: 'p3',
      name: 'Linen Cushion Cover',
      sku: 'AE-HM-003',
      category: 'Home & Living',
      hsn: '630492',
      price: 599,
      cost: 240,
      gst: 5,
      stock: 8,
      lowStock: 15,
      unit: 'PCS',
      color: 'green',
    },
    {
      id: 'p4',
      name: 'Classic Desk Organizer',
      sku: 'AE-DS-004',
      category: 'Workspace',
      hsn: '442199',
      price: 1299,
      cost: 540,
      gst: 12,
      stock: 34,
      lowStock: 10,
      unit: 'PCS',
      color: 'purple',
    },
    {
      id: 'p5',
      name: 'Insulated Water Bottle',
      sku: 'AE-BT-005',
      category: 'Lifestyle',
      hsn: '961700',
      price: 899,
      cost: 410,
      gst: 18,
      stock: 12,
      lowStock: 20,
      unit: 'PCS',
      color: 'blue',
    },
    {
      id: 'p6',
      name: 'Minimal Daily Planner',
      sku: 'AE-ST-006',
      category: 'Workspace',
      hsn: '482010',
      price: 399,
      cost: 145,
      gst: 12,
      stock: 65,
      lowStock: 10,
      unit: 'PCS',
      color: 'rose',
    },
  ];
  const invoices: Invoice[] = [];
  for (let n = 0; n < 28; n++) {
    const c = customers[n % customers.length],
      p = products[n % products.length],
      date = offset(-n * 2);
    const i: Invoice = {
      id: `i${n}`,
      number: `AE/${fy(date)}/${String(1048 - n).padStart(4, '0')}`,
      customer: { ...c },
      business: { ...business },
      date,
      dueDate: offset(-n * 2 + 14),
      placeOfSupply: c.state,
      shippingAddress: c.address,
      channel: ['Direct', 'Website', 'Amazon', 'Flipkart'][n % 4] as Invoice['channel'],
      reference: n % 4 ? `ORD-${8040 + n}` : '',
      items: [
        {
          productId: p.id,
          name: p.name,
          hsn: p.hsn,
          unit: p.unit,
          qty: c.type === 'B2B' ? 20 + n : 1 + (n % 4),
          price: p.price,
          discount: n % 3 === 0 ? 5 : 0,
          gst: p.gst,
        },
      ],
      notes: 'Sample invoice for demonstration.',
      status: n === 5 ? 'draft' : 'issued',
      paid: 0,
      createdAt: `${date}T10:00:00Z`,
    };
    const total = invoiceTotals(i).total;
    i.paid =
      i.status === 'draft' ? 0 : n % 7 === 0 ? 0 : n % 7 === 2 ? Math.round(total * 0.4) : total;
    invoices.push(i);
  }
  return {
    business,
    customers,
    products,
    invoices,
    payments: invoices
      .filter((i) => i.paid > 0)
      .map((i) => ({
        id: `pay-${i.id}`,
        invoiceId: i.id,
        invoiceNumber: i.number,
        customerName: i.customer.name,
        amount: i.paid,
        date: i.date,
        method: ['UPI', 'Bank transfer', 'Card'][Number(i.id.slice(1)) % 3],
        reference: `DEMO-${i.id}`,
      })),
    audit: [
      {
        id: 'a1',
        action: 'Demo workspace loaded',
        detail: 'Sample records · explore without affecting live business data',
        at: new Date().toISOString(),
      },
    ],
    counters: { [fy(today())]: 1048 },
  };
}
