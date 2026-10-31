import { z } from 'zod';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const text = z.string().max(200);
const amount = z.number().min(0).max(1_000_000_000_000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Invalid calendar date');
const business = z
  .object({
    invoiceTemplate: z.enum(['classic', 'modern', 'minimal']).optional(),
    setupCompleted: z.boolean().optional(),
    name: text,
    gstin: z.string().max(15),
    state: z.string().length(2),
    address: z.string().max(2000),
    email: text,
    phone: text,
    bankName: text,
    account: text,
    ifsc: text,
    upi: text,
    terms: z.string().max(4000),
    prefix: z.string().max(5),
  })
  .strict();
const customer = z
  .object({
    id,
    name: text,
    type: z.enum(['B2B', 'B2C']),
    email: text,
    phone: text,
    gstin: z.string().max(15),
    state: z.string().length(2),
    address: z.string().max(2000),
  })
  .strict();
const product = z
  .object({
    id,
    name: text,
    sku: text,
    category: text,
    hsn: z.string().max(8),
    price: amount,
    cost: amount,
    gst: z.number().min(0).max(100),
    stock: amount,
    lowStock: amount,
    unit: text,
    color: text,
  })
  .strict();
const item = z
  .object({
    costTotal: amount.optional(),
    productId: id,
    name: text,
    hsn: z.string().max(8),
    unit: text,
    qty: z.number().positive(),
    price: amount,
    discount: z.number().min(0).max(100),
    gst: z.number().min(0).max(100),
  })
  .strict();
const invoice = z
  .object({
    roundOff: z.number().min(-0.5).max(0.5).optional(),
    id,
    number: text,
    customer,
    business,
    date,
    dueDate: date,
    placeOfSupply: z.string().length(2),
    shippingAddress: z.string().max(2000),
    reference: text,
    items: z.array(item).min(1).max(50),
    notes: z.string().max(4000),
    status: z.enum(['draft', 'issued', 'void']),
    paid: amount,
    createdAt: z.string().max(40),
  })
  .strict();
const payment = z
  .object({
    id,
    invoiceId: id,
    invoiceNumber: text,
    customerName: text,
    amount: z.number().positive(),
    date,
    method: z.enum(['UPI', 'Bank transfer', 'Cash', 'Card', 'Cheque']),
    reference: text,
  })
  .strict();
export const commandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('purchase'),
      purchase: z
        .object({
          id,
          productId: id,
          quantity: z.number().positive().max(1e9),
          unitCost: amount,
          date,
          reference: text,
        })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal('saveCustomer'), customer }).strict(),
  z.object({ type: z.literal('saveProduct'), product }).strict(),
  z.object({ type: z.literal('saveBusiness'), business }).strict(),
  z.object({ type: z.literal('saveInvoice'), invoice, issue: z.boolean() }).strict(),
  z.object({ type: z.literal('payment'), payment }).strict(),
  z.object({ type: z.literal('void'), id }).strict(),
  z.object({ type: z.literal('deleteDraft'), id }).strict(),
  z
    .object({
      type: z.literal('stock'),
      id,
      quantity: z.number(),
      reason: z.string().min(1).max(1000),
    })
    .strict(),
]);
export const requestSchema = z.object({ requestId: id, command: commandSchema }).strict();
