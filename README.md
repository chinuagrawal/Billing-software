# Agrawal Enterprises — Billing workspace

A React + TypeScript billing application for **Agrawal Enterprises, Rajasthan**, for B2B and B2C billing, with a responsive business dashboard, GST-aware domestic B2B/B2C invoicing, inventory and customer management, payment records, reporting, Firebase integration, and a trusted server API. Deploy the frontend and API together on Vercel.

## Run locally

Use Node.js 24 and npm.

```sh
npm install
npm run dev
```

Open the local URL printed in the terminal, normally `http://127.0.0.1:5173`.

```sh
npm test        # Billing invariants and financial edge cases
npm run build  # TypeScript check and production bundle
npm run preview
```

The app opens in a clearly labelled **demo workspace** when Firebase is not configured or you are signed out. Demo changes persist in this browser's local storage. The demo uses fictional contacts and sample products, prices, tax rates and invoices. The supplier GSTIN is intentionally blank. Sample invoices are marked as demonstration documents when printed. Do not use sample tax rates or identities for actual transactions.

## Included workflows

- Dashboard with date-range sales chart, B2B/B2C mix, real balances, overdue invoices and low-stock reminders.
- Customer records with B2B/B2C distinction, addresses, contact details, GSTIN format/checksum and state validation.
- Product catalogue with SKU, HSN/SAC, configurable GST rate, selling price, purchase cost, units and stock thresholds.
- Stock adjustments with mandatory reasons and an activity record.
- Invoice drafts, line quantities/prices/discounts, place of supply, billing references.
- Domestic intrastate CGST + SGST/UTGST and interstate IGST calculation. Prices exclude GST. Individual tax components round to paise per line.
- Financial-year sequence allocated only when issuing, with invoice numbers limited to 16 characters. Stock is deducted in the same operation.
- Issued customer/business/item snapshots are retained; editing a customer or business does not rewrite old invoices.
- Unpaid issued invoices can be voided with stock restoration. Their numbers are retained and never reused.
- Partial/full payment recording, overpayment prevention, receipts ledger and invoice status calculation.
- Print-friendly A4 invoices; use the browser's **Print / PDF → Save as PDF** to download a PDF.
- Sales, inventory, payments and GST sales-register CSV exports, with spreadsheet formula-injection protection.
- Date-filtered tax summaries, B2B/B2C sales analysis, receivables ageing and activity history.
- Business/bank/UPI/terms settings and complete JSON backup download.
- Firebase phone OTP sign-in with reCAPTCHA, resend cooldown and per-account Firestore data isolation. Email sign-in remains available for existing accounts.
- Server-side financial validation, verified/revocation-checked authentication, transactional SKU reservations, and idempotent write requests.

## Connect Firebase

1. Create a project in the [Firebase console](https://console.firebase.google.com/).
2. Register a **Web app** and copy its Firebase configuration.
3. Copy `.env.example` to `.env.local`. Fill all six `VITE_FIREBASE_*` variables with your web app configuration. At minimum, API key, auth domain, project ID and app ID are required.

   Also configure the three **server-only** variables: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. Use a service account from the same Firebase project, with Firestore access and permission to verify Firebase Auth users. Follow the [Firebase Admin setup guide](https://firebase.google.com/docs/admin/setup) to obtain credentials through your project administration. In a local dotenv file, quote the PEM key and represent line breaks as `\n`; in Vercel, enter the complete private key as an environment value. These credentials must never use the `VITE_` prefix or be committed to Git.

   The development server provides `/api/command` locally; the same handler becomes a Vercel serverless function in production. `npm run preview` serves the built frontend only—use `npm run dev` or Vercel for cloud-write integration testing.

4. Enable **Authentication → Sign-in method → Phone**. Under **Authentication → Settings → SMS region policy**, allow India (and any other countries you serve). Link a Cloud Billing account for real SMS. Enable Email/Password only if you want the optional email sign-in fallback.
5. Create a **Cloud Firestore** database. Choose an appropriate region for your business; an India region may be appropriate if available for your requirements.
6. In Authentication settings, add your local and deployed domains to **Authorized domains**. Newly created projects may require adding `localhost` and `127.0.0.1` explicitly.
7. Deploy the included rules and indexes to your project. After installing the official Firebase CLI and signing in:

   ```sh
   firebase deploy --only firestore --project YOUR_FIREBASE_PROJECT_ID
   ```

   Alternatively, paste `firestore.rules` into the Firestore Rules editor and publish it. Do not use public test-mode rules.

8. Restart `npm run dev`. Open **Settings → Connect workspace**, request an OTP and verify your mobile number. The first verified sign-in creates your owner account.
9. Your cloud workspace starts **empty**. Add your real business details, GSTIN, customers and products. Demo records are never automatically uploaded.

Firebase web configuration is intended for the browser; Firestore rules provide authorization. Never put service-account private keys, Firebase Admin credentials, payment-provider secrets in `VITE_*` variables.

### Phone OTP setup for this project

The local web configuration is set to **billing-software-atd** in the Git-ignored `.env.local`. `.firebaserc` selects that project for Firebase CLI commands. The public web configuration is also committed in `.env.production` so Vercel production builds can show phone login without relying on the local file. Vercel environment variables override these defaults. Never add server credentials to `.env.production`.

1. Enable Phone sign-in in the [project Authentication console](https://console.firebase.google.com/project/billing-software-atd/authentication/providers).
2. Configure SMS region policy to allow India. Real verification SMS requires a linked billing account; charges and quotas apply.
3. In Authentication settings, add the exact Vercel hostname and any custom domain to **Authorized domains**. Firebase documents that localhost is not supported as a hosted domain for production phone authentication; validate real SMS on your authorized deployed HTTPS domain.
4. For development, configure a fictional phone number and fixed verification code in **Phone numbers for testing** under the Phone provider. These test numbers do not receive SMS. Do not commit those test codes or disable app verification in production.
5. Deploy Firestore rules with `npx firebase-tools login`, then `npx firebase-tools deploy --only firestore --project billing-software-atd`. Create the Firestore database in the console first if it does not exist.
6. Configure the three server-only credentials in Vercel so verified users can save billing records. Web configuration alone enables authentication but does not configure the trusted write API. Never send the service-account key in chat or add it to Git.

The app uses Firebase's reCAPTCHA verification before SMS, a 60-second resend cooldown, a six-digit OTP input and clear errors. The cooldown is only a usability control; Firebase enforces SMS limits. The phone number is processed by Google for spam/abuse prevention, and the form asks for consent before sending. No real SMS is sent by automated tests.

An email account and an independently created phone account have different Firebase UIDs and therefore separate billing workspaces. Existing email users should keep using email sign-in; account linking/migration is not implemented.

References: [Firebase web phone authentication](https://firebase.google.com/docs/auth/web/phone-auth) and [SMS billing requirements](https://firebase.google.com/docs/auth/faq-and-troubleshooting).

### Firestore structure and integrity

Each owner has isolated collections below `workspaces/{firebaseAuthUid}/`:

| Collection          | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `settings/business` | Supplier profile, bank details, invoice prefix and terms |
| `customers`         | Customer master records                                  |
| `products`          | Products and current stock                               |
| `invoices`          | Drafts and immutable issued invoice snapshots            |
| `payments`          | Append-only payment receipts                             |
| `counters`          | Invoice sequence by Indian financial year                |
| `audit`             | Append-only activity entries                             |
| `operations`        | Server-only idempotency receipts                         |
| `skuIndex`          | Server-only case-insensitive SKU reservations            |

Cloud mutations are sent to `/api/command` with a Firebase ID token. The server verifies the token, checks for revocation, derives the workspace owner from the verified identity, validates the command schema, and performs calculations against database records. Invoice issuance, stock adjustments, voiding and payments use Firestore transactions. Affected invoices, products and counters are read inside the transaction so concurrent devices cannot oversell, reuse sequence numbers or overpay an invoice through the API. Local demo writes use the browser Web Locks API where available.

Rules permit only owner-scoped reads of business records and **deny all direct client writes**. The Admin SDK writes through the validated command service. There is no API to edit issued invoice details, rewrite receipts/audit entries, or delete records. Request IDs and payload hashes protect repeated requests from applying twice; unfinished requests reuse their IDs while the browser session remains open. SKU reservations prevent concurrent duplicate product identifiers and retain previously assigned SKUs for their original products. The current release is a single-owner workspace, not a multi-role team system. Project administrators with direct database access remain privileged.

## Deploy to Vercel

1. Push this project to your own Git repository and import it into [Vercel](https://vercel.com/new).
2. Select the **Vite** framework preset and Node.js **24.x**.
3. Build command: `npm run build`. Output directory: `dist`. The included `vercel.json` provides these defaults and SPA routing.
4. Add the six `VITE_FIREBASE_*` variables and the three server-only `FIREBASE_*` credentials to the desired Vercel environments. Vite substitutes browser variables at build time, so redeploy after changing them. Keep server credentials private and use separate staging and production projects.
5. Deploy and add the resulting hostname (and your custom domain, if used) to Firebase Authentication's authorized domains.
6. Sign in and verify a small test transaction in your own staging Firebase project before using a production database.

No Firebase project, credentials, Vercel account or production deployment has been created or connected automatically.

## Business setup

In **Settings**, enter your legal name, actual GSTIN, registered address, contact details and payment instructions. Rajasthan uses state code `08`. GSTIN checksum validation only checks structure; it does not verify registration status with the GST portal.

Add correct HSN/SAC codes and applicable rates to each product. Invoice tax treatment uses the explicitly selected **place of supply**, not merely the customer's address. The app assumes a regular registered supplier and ordinary domestic forward-charge sales; reverse charge, exports, SEZ supplies, cess, composition schemes and exempt-supply documents require additional workflows.

The CSV is an accounting sales register, **not a GST-portal upload schema or a filed return**. IRN/e-invoice generation, signed QR codes, e-way bills and GST return submission are not connected. Recording a payment does not collect money.

Consult your accountant about your applicable requirements. Invoice fields were informed by the [CBIC invoice particulars](https://cbic-gst.gov.in/gst-invoice-rules.html); check current legal applicability for your business. Implementation references: [Firebase transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [Firebase authorization rules](https://firebase.google.com/docs/rules/basics), and [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).

## Production scope and next-stage work

This is a working billing application and deployment-ready project foundation, not a certified enterprise accounting/ERP system. Before a wider enterprise rollout, the remaining work includes:

- Connect and verify your actual Firebase and Vercel projects; test rules against the Firebase emulator and staging environment.
- Add role-based teams, approval workflows, infrastructure rate limits and tamper-resistant audit retention.
- Credit notes, returns/refunds, purchase orders, supplier bills, stock lots/multiple warehouses and accounting journal entries.
- GST API/GSP integration for applicable IRN, e-way-bill and filing workflows.
- Server-side pagination and aggregate reporting for large histories, monitoring, automated database backups and tested restoration.

Current collection listeners load the owner's records into memory. JSON downloads are manual backups; no automated restore or scheduled backup service is configured.

## Source map

- `src/lib/billing.ts` — shared financial calculations, validation and business mutations.
- `src/lib/store.tsx` — local persistence, authentication, Firestore listeners and authenticated API calls.
- `api/command.ts` — Vercel HTTP endpoint, token verification, request size limits and safe errors.
- `server/schema.ts` — runtime validation of every accepted command.
- `server/commands.ts` — authoritative transactional writes, SKU reservations and idempotency.
- `src/lib/seed.ts` — clearly separated demo data and empty cloud defaults.
- `src/components/` — dashboard, record lists, forms, invoice editor/view, reports and settings.
- `firestore.rules` — owner-scoped reads and complete denial of direct client writes.
- `src/lib/billing.test.ts` — automated financial and lifecycle tests.
- `server/*.test.ts` — server boundary, authentication, tenant isolation and replay protection tests using isolated mocks. A real Firebase project/emulator integration run is still required before live rollout.

`@grpc/grpc-js` is overridden to a patched compatible 1.x release because the Firebase SDK pins an older Node transport dependency. The browser app uses Firebase's browser transport.
