import { NextRequest, NextResponse } from "next/server";
import { requireApiKey, listParams, type V1Scope } from "@/lib/api-auth";

/** Wrap a v1 read endpoint: token auth (scoped to `scope`) + list params + JSON error envelope. */
export function v1List<T>(scope: V1Scope, fetcher: (p: { take: number; skip: number }) => Promise<T[]>) {
  return async (req: NextRequest) => {
    const auth = await requireApiKey(req, scope);
    if (!auth.ok) return auth.res;
    try {
      const p = listParams(req);
      const data = await fetcher(p);
      return NextResponse.json({ data, take: p.take, skip: p.skip, count: data.length });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 500 });
    }
  };
}
