import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { currentUser, hasAnyRole } from "@/lib/rbac";
import { currentFiscalYear } from "@/lib/dates";
import { REPORTS } from "@/lib/kpi/reports";

/** §10-G xlsx export — same registry function as the on-screen report, styled with the brand. */
export async function GET(req: NextRequest, { params }: { params: { key: string } }) {
  const user = await currentUser();
  if (!user || !hasAnyRole(user, ["ADMIN", "DIRECTOR", "ACCOUNTANT", "PURCHASER", "DEPT_MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const report = REPORTS[params.key];
  if (!report) return NextResponse.json({ error: "Unknown report" }, { status: 404 });

  const fy = Number(req.nextUrl.searchParams.get("fy")) || currentFiscalYear();
  const t = await getTranslations("reports");
  const table = await report.fn(fy);

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Humiley Procurement Portal";
  const ws = wb.addWorksheet(t(`names.${params.key}`).slice(0, 31));

  ws.addRow([`${t(`names.${params.key}`)} — FY ${fy}`]);
  ws.getRow(1).font = { bold: true, size: 14, color: { argb: "FF205090" } };
  ws.addRow([]);

  const header = ws.addRow(table.columns.map((c) => t(`cols.${c}`)));
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF205090" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF00B060" } } };
  });
  for (const row of table.rows) ws.addRow(row);
  ws.columns.forEach((col, i) => {
    let max = t(`cols.${table.columns[i]}`).length;
    for (const row of table.rows) max = Math.max(max, String(row[i] ?? "").length);
    col.width = Math.min(48, Math.max(10, max + 2));
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${params.key}-fy${fy}.xlsx"`,
    },
  });
}
