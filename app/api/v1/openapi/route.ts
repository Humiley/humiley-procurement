import { NextResponse } from "next/server";

/** §17 OpenAPI description of the read-first v1 API (hand-maintained literal). */
const LIST_PARAMS = [
  { name: "take", in: "query", schema: { type: "integer", maximum: 200, default: 50 } },
  { name: "skip", in: "query", schema: { type: "integer", default: 0 } },
];
const listPath = (tag: string, desc: string) => ({
  get: {
    tags: [tag],
    summary: desc,
    parameters: LIST_PARAMS,
    security: [{ bearerAuth: [] }],
    responses: { "200": { description: "OK" }, "401": { description: "Missing/invalid API key" } },
  },
});

const spec = {
  openapi: "3.0.3",
  info: { title: "Humiley Procurement API", version: "1.0.0", description: "Read-first REST API (§17). Authenticate with an API key minted in Admin → Governance: `Authorization: Bearer hml_…`" },
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
  paths: {
    "/api/v1/vendors": listPath("vendors", "Approved-vendor master (status, terms, bank flags)"),
    "/api/v1/purchase-orders": listPath("purchase-orders", "Purchase orders with lines and received/invoiced quantities"),
    "/api/v1/invoices": listPath("invoices", "Vendor invoices with match/payment status and export batch"),
    "/api/v1/payment-requests": listPath("payment-requests", "Payment requests with status, payee and payment reference"),
    "/api/v1/stock-balances": listPath("stock-balances", "On-hand stock by warehouse × item × lot at moving-average cost"),
    "/api/v1/requisitions": listPath("requisitions", "Purchase requisitions with requester, status, estimate"),
  },
};

export function GET() {
  return NextResponse.json(spec);
}
