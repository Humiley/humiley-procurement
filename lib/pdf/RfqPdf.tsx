/* eslint-disable jsx-a11y/alt-text */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerPdfFonts } from "./fonts";

/**
 * §8 RFQ PDF — one per invited vendor, on the §10 letterhead style. Same visual language as the
 * PO PDF (two-tone bar, wordmark, bilingual labels, navy table) but with a blank price column
 * for the vendor to fill, plus a terms-requested block. Vietnamese-safe fonts (§22.4).
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
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  wordmark: { fontSize: 18, fontWeight: 700, color: NAVY },
  wordmarkSub: { fontSize: 7.5, color: GREY, marginTop: 1 },
  docNo: { fontSize: 10, fontWeight: 700, color: NAVY, textAlign: "right" },
  docMeta: { fontSize: 7.5, color: GREY, textAlign: "right", marginTop: 2 },
  title: { fontSize: 14, fontWeight: 700, color: NAVY, marginTop: 10 },
  titleVn: { fontSize: 9, color: GREY, fontStyle: "italic", marginBottom: 10 },
  box: { backgroundColor: PANEL, borderRadius: 4, padding: 8, marginBottom: 10 },
  boxHead: { fontSize: 8, fontWeight: 700, color: NAVY, marginBottom: 4, textTransform: "uppercase" },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 3 },
  th: { flexDirection: "row", backgroundColor: NAVY },
  thCell: { color: "#fff", fontSize: 8, fontWeight: 700, paddingVertical: 4, paddingHorizontal: 5 },
  tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE },
  td: { fontSize: 8.5, paddingVertical: 5, paddingHorizontal: 5 },
  right: { textAlign: "right" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 4 },
  footText: { fontSize: 7, color: GREY },
});

export type RfqPdfData = {
  rfqNumber: string;
  title: string;
  createdAt: string;
  dueDate: string;
  vendor: { nameEn: string; nameVn: string; contact?: string | null };
  buyer: { name: string; address: string; email: string };
  lines: { no: number; description: string; uom: string; qty: string }[];
};

export function RfqPdf({ d }: { d: RfqPdfData }) {
  registerPdfFonts();
  const W = { no: 26, desc: 250, uom: 50, qty: 70, price: 90, amount: 90 };
  return (
    <Document title={d.rfqNumber} author="Humiley Procurement Portal">
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
            <Text style={s.docNo}>{d.rfqNumber}</Text>
            <Text style={s.docMeta}>HML-RFQ · Rev 01.0 · {d.createdAt}</Text>
          </View>
        </View>

        <Text style={s.title}>REQUEST FOR QUOTATION</Text>
        <Text style={s.titleVn}>Yêu cầu báo giá — {d.title}</Text>

        <View style={s.box}>
          <Text style={s.boxHead}>To · Kính gửi</Text>
          <Text style={{ fontSize: 9, fontWeight: 700 }}>{d.vendor.nameEn}</Text>
          <Text style={{ fontSize: 8, color: GREY, fontStyle: "italic" }}>{d.vendor.nameVn}</Text>
          {d.vendor.contact ? <Text style={{ fontSize: 8, color: GREY, marginTop: 2 }}>{d.vendor.contact}</Text> : null}
          <Text style={{ fontSize: 8.5, marginTop: 6 }}>
            Please quote your best unit prices for the items below and return this form by{" "}
            <Text style={{ fontWeight: 700, color: NAVY }}>{d.dueDate}</Text>.
          </Text>
          <Text style={{ fontSize: 8, color: GREY, fontStyle: "italic" }}>
            Vui lòng báo giá tốt nhất cho các hạng mục dưới đây và gửi lại trước ngày {d.dueDate}.
          </Text>
        </View>

        <View style={s.table}>
          <View style={s.th} fixed>
            <Text style={[s.thCell, { width: W.no }]}>#</Text>
            <Text style={[s.thCell, { width: W.desc, flex: 1 }]}>Description · Diễn giải</Text>
            <Text style={[s.thCell, { width: W.uom }]}>UoM</Text>
            <Text style={[s.thCell, { width: W.qty }, s.right]}>Qty · SL</Text>
            <Text style={[s.thCell, { width: W.price }, s.right]}>Unit price · Đơn giá</Text>
            <Text style={[s.thCell, { width: W.amount }, s.right]}>Lead time · Thời gian giao</Text>
          </View>
          {d.lines.map((l) => (
            <View style={s.tr} key={l.no} wrap={false}>
              <Text style={[s.td, { width: W.no }]}>{l.no}</Text>
              <Text style={[s.td, { width: W.desc, flex: 1 }]}>{l.description}</Text>
              <Text style={[s.td, { width: W.uom }]}>{l.uom}</Text>
              <Text style={[s.td, { width: W.qty }, s.right]}>{l.qty}</Text>
              <Text style={[s.td, { width: W.price }, s.right]}> </Text>
              <Text style={[s.td, { width: W.amount }, s.right]}> </Text>
            </View>
          ))}
        </View>

        <View style={[s.box, { marginTop: 10 }]}>
          <Text style={s.boxHead}>Please also state · Vui lòng nêu rõ</Text>
          <Text style={{ fontSize: 8.5 }}>• Payment terms · Điều khoản thanh toán</Text>
          <Text style={{ fontSize: 8.5 }}>• Quote validity · Hiệu lực báo giá</Text>
          <Text style={{ fontSize: 8.5 }}>• Delivery lead time · Thời gian giao hàng</Text>
          <Text style={{ fontSize: 8.5 }}>• VAT treatment · Thuế GTGT</Text>
        </View>

        <View style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 8, color: GREY }}>
            {d.buyer.name} · {d.buyer.address} · {d.buyer.email}
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footText}>Humiley Procurement Portal — request for quotation</Text>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `${d.rfqNumber} · Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
