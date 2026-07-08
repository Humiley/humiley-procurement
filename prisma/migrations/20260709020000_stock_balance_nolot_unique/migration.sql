-- NULL lotId rows are "distinct" under the 3-column unique index; this partial index makes the
-- no-lot balance row truly unique per (warehouse, item) so the single-writer upsert cannot race.
CREATE UNIQUE INDEX "StockBalance_wh_item_nolot_key" ON "StockBalance"("warehouseId", "itemId") WHERE "lotId" IS NULL;
