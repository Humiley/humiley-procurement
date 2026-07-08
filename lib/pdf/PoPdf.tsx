/* eslint-disable jsx-a11y/alt-text */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerPdfFonts } from "./fonts";

/**
 * §8 + §10: the PO PDF on the Humiley letterhead style — two-tone top bar (emerald wider than
 * navy), typographic wordmark, doc number top-right, bilingual field labels (EN primary,
 * VN italic grey), navy table headers, terms block, §19 signature block, footer "Page X / Y"
 * + doc code. All text in Be Vietnam Pro (Vietnamese-safe, §22.4).
 */

const NAVY = "#205090";
const EMERALD = "#00B060";
const BODY = "#1F2937";
const GREY = "#5C6470";
const PANEL = "#F7F9FC";
const LINE = "#D8DEE8";

const s = StyleSheet.create({
  page: { fontFamily: "BeVietnamPro", fontSize: 9, color: BODY, paddingTop: 28, paddingHorizontal: 36, paddingBottom: 56 },
  barRow: { flexDirection: "row", height: 5, marginBottom: 14 },
  barEmerald: { flex: 7, backgroundColor: EMERALD },
  barNavy: { flex: 3, backgroundColor: NAVY },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  wordmark: { fontSize: 18, fontWeight: 700, color: NAVY },
  wordmarkSub: { fontSize: 7.5, color: GREY, marginTop: 1 },
  docNo: { fontSize: 10, fontWeight: 700, color: NAVY, textAlign: "right" },
  docMeta: { fontSize: 7.5, color: GREY, textAlign: "right", marginTop: 2 },
  title: { fontSize: 14, fontWeight: 700, color: NAVY, marginTop: 10 },
  titleVn: { fontSize: 9, color: GREY, fontStyle: "italic", marginBottom: 10 },
  cols: { flexDirection: "row", gap: 12, marginBottom: 10 },
  box: { flex: 1, backgroundColor: PANEL, borderRadius: 4, padding: 8 },
  boxHead: { fontSize: 8, fontWeight: 700, color: NAVY, marginBottom: 4, textTransform: "uppercase" },
  fRow: { flexDirection: "row", marginBottom: 2 },
  fLabel: { width: 95, fontSize: 8, color: GREY },
  fValue: { flex: 1, fontSize: 8.5 },
  table: { marginTop: 4, borderWidth: 1, borderColor: LINE, borderRadius: 3 },
  th: { flexDirection: "row", backgroundColor: NAVY },
  thCell: { color: "#fff", fontSize: 8, fontWeight: 700, paddingVertical: 4, paddingHorizontal: 5 },
  tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE },
  td: { fontSize: 8.5, paddingVertical: 4, paddingHorizontal: 5 },
  right: { textAlign: "right" },
  totals: { marginTop: 6, alignSelf: "flex-end", width: 220 },
  totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totLabel: { fontSize: 8.5, color: GREY },
  totValue: { fontSize: 8.5, fontWeight: 700 },
  grand: { borderTopWidth: 1, borderTopColor: NAVY, marginTop: 2, paddingTop: 3 },
  grandText: { fontSize: 10, fontWeight: 700, color: NAVY },
  sigTitle: { fontSize: 9, fontWeight: 700, color: NAVY, marginTop: 16, marginBottom: 4 },
  sigRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE, paddingVertical: 3 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 4 },
  footText: { fontSize: 7, color: GREY },
});

export type PoPdfData = {
  poNumber: string;
  createdAt: string;
  status: string;
  buyer: { name: string; address: string; taxNote?: string };
  vendor: { code: string; nameEn: string; nameVn: string; address?: string | null; taxCode?: string | null; contact?: string | null };
  header: {
    currency: string;
    fxRate: string;
    paymentTerms?: string | null;
    incoterm?: string | null;
    incotermPlace?: string | null;
    deliveryAddress?: string | null;
    expectedDate?: string | null;
    warrantyTerms?: string | null;
    prNumber?: string | null;
  };
  lines: { no: number; description: string; uom: string; qty: string; unitPrice: string; amount: string }[];
  totals: { subtotal: string; vatPct: string; vatAmount: string; total: string; totalInWords?: string };
  signatures: { name: string; meaning: string; signedAt: string; reason?: string | null }[];
};

function Bi({ en, vn }: { en: string; vn: string }) {
  return (
    <Text style={s.fLabel}>
      {en} <Text style={{ fontStyle: "italic" }}>· {vn}</Text>
    </Text>
  );
}

export function PoPdf({ d }: { d: PoPdfData }) {
  registerPdfFonts();
  const W = { no: 26, desc: 200, uom: 44, qty: 60, price: 90, amount: 100 };
  return (
    <Document title={d.poNumber} author="Humiley Procurement Portal">
      <Page size="A4" style={s.page}>
        <View style={s.barRow} fixed>
          <View style={s.barEmerald} />
          <View style={s.barNavy} />
        </View>

        <View style={s.headRow}>
          <View>
            <Text style={s.wordmark}>Humiley</Text>
            <Text style={s.wordmarkSub}>ENGINEERING &amp; SOLUTIONS</Text>
          </View>
          <View>
            <Text style={s.docNo}>{d.poNumber}</Text>
            <Text style={s.docMeta}>HML-PO · Rev 01.0 · {d.createdAt}</Text>
            <Text style={s.docMeta}>{d.status}</Text>
          </View>
        </View>

        <Text style={s.title}>PURCHASE ORDER</Text>
        <Text style={s.titleVn}>Đơn đặt hàng</Text>

        <View style={s.cols}>
          <View style={s.box}>
            <Text style={s.boxHead}>Buyer · Bên mua</Text>
            <Text style={{ fontSize: 9, fontWeight: 700 }}>{d.buyer.name}</Text>
            <Text style={{ fontSize: 8, color: GREY, marginTop: 2 }}>{d.buyer.address}</Text>
          </View>
          <View style={s.box}>
            <Text style={s.boxHead}>Supplier · Nhà cung cấp</Text>
            <Text style={{ fontSize: 9, fontWeight: 700 }}>{d.vendor.nameEn}</Text>
            <Text style={{ fontSize: 8, color: GREY, fontStyle: "italic" }}>{d.vendor.nameVn}</Text>
            {d.vendor.address ? <Text style={{ fontSize: 8, color: GREY, marginTop: 2 }}>{d.vendor.address}</Text> : null}
            {d.vendor.taxCode ? <Text style={{ fontSize: 8, color: GREY }}>Tax code · MST: {d.vendor.taxCode}</Text> : null}
            {d.vendor.contact ? <Text style={{ fontSize: 8, color: GREY }}>{d.vendor.contact}</Text> : null}
          </View>
        </View>

        <View style={s.box}>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <View style={s.fRow}><Bi en="Reference PR" vn="Số PR" /><Text style={s.fValue}>{d.header.prNumber || "—"}</Text></View>
              <View style={s.fRow}><Bi en="Currency / FX" vn="Tiền tệ / Tỷ giá" /><Text style={s.fValue}>{d.header.currency} / {d.header.fxRate}</Text></View>
              <View style={s.fRow}><Bi en="Payment terms" vn="Điều khoản thanh toán" /><Text style={s.fValue}>{d.header.paymentTerms || "—"}</Text></View>
              <View style={s.fRow}><Bi en="Incoterms 2020" vn="Điều kiện giao hàng" /><Text style={s.fValue}>{d.header.incoterm ? `${d.header.incoterm}${d.header.incotermPlace ? " — " + d.header.incotermPlace : ""}` : "—"}</Text></View>
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.fRow}><Bi en="Delivery address" vn="Địa chỉ giao hàng" /><Text style={s.fValue}>{d.header.deliveryAddress || "—"}</Text></View>
              <View style={s.fRow}><Bi en="Expected date" vn="Ngày giao dự kiến" /><Text style={s.fValue}>{d.header.expectedDate || "—"}</Text></View>
              <View style={s.fRow}><Bi en="Warranty" vn="Bảo hành" /><Text style={s.fValue}>{d.header.warrantyTerms || "—"}</Text></View>
            </View>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.th} fixed>
            <Text style={[s.thCell, { width: W.no }]}>#</Text>
            <Text style={[s.thCell, { width: W.desc, flex: 1 }]}>Description · Diễn giải</Text>
            <Text style={[s.thCell, { width: W.uom }]}>UoM</Text>
            <Text style={[s.thCell, { width: W.qty }, s.right]}>Qty · SL</Text>
            <Text style={[s.thCell, { width: W.price }, s.right]}>Unit price · Đơn giá</Text>
            <Text style={[s.thCell, { width: W.amount }, s.right]}>Amount · Thành tiền</Text>
          </View>
          {d.lines.map((l) => (
            <View style={s.tr} key={l.no} wrap={false}>
              <Text style={[s.td, { width: W.no }]}>{l.no}</Text>
              <Text style={[s.td, { width: W.desc, flex: 1 }]}>{l.description}</Text>
              <Text style={[s.td, { width: W.uom }]}>{l.uom}</Text>
              <Text style={[s.td, { width: W.qty }, s.right]}>{l.qty}</Text>
              <Text style={[s.td, { width: W.price }, s.right]}>{l.unitPrice}</Text>
              <Text style={[s.td, { width: W.amount }, s.right]}>{l.amount}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals}>
          <View style={s.totRow}><Text style={s.totLabel}>Subtotal · Cộng</Text><Text style={s.totValue}>{d.totals.subtotal}</Text></View>
          <View style={s.totRow}><Text style={s.totLabel}>VAT {d.totals.vatPct}% · Thuế GTGT</Text><Text style={s.totValue}>{d.totals.vatAmount}</Text></View>
          <View style={[s.totRow, s.grand]}><Text style={s.grandText}>TOTAL · Tổng cộng</Text><Text style={s.grandText}>{d.totals.total}</Text></View>
        </View>

        <Text style={s.sigTitle}>Electronic signatures · Chữ ký điện tử (21 CFR Part 11)</Text>
        {d.signatures.length === 0 ? (
          <Text style={{ fontSize: 8, color: GREY }}>No signatures yet · Chưa có chữ ký</Text>
        ) : (
          d.signatures.map((g, i) => (
            <View style={s.sigRow} key={i} wrap={false}>
              <Text style={{ fontSize: 8.5, fontWeight: 700, width: 150 }}>{g.name}</Text>
              <Text style={{ fontSize: 8, color: NAVY, fontWeight: 700, width: 80 }}>{g.meaning}</Text>
              <Text style={{ fontSize: 8, color: GREY, width: 120 }}>{g.signedAt}</Text>
              <Text style={{ fontSize: 8, color: GREY, flex: 1 }}>{g.reason || ""}</Text>
            </View>
          ))
        )}

        <View style={s.footer} fixed>
          <Text style={s.footText}>Humiley Procurement Portal — computer-generated purchase order</Text>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `${d.poNumber} · Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
