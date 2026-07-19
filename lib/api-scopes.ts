/**
 * Read scopes for the /api/v1 REST API — one per resource. Plain constants (no `server-only`) so the
 * admin UI can import the list to render scope checkboxes; the server enforces them in lib/api-auth.ts.
 * Keep in sync with the v1 route folders.
 */
export const V1_SCOPES = [
  "requisitions",
  "purchase-orders",
  "invoices",
  "payment-requests",
  "vendors",
  "stock-balances",
] as const;
export type V1Scope = (typeof V1_SCOPES)[number];
