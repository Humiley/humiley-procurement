-- Per-key read scopes for the /api/v1 REST API. Existing keys keep an empty array, which lib/api-auth
-- treats as full access (backward compatible); new keys store an explicit scope list.
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
