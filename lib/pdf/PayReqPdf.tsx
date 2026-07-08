/* eslint-disable jsx-a11y/alt-text */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerPdfFonts } from "./fonts";

/** §10a payment-request voucher — brand letterhead, bilingual, three signature blocks. */

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
  box: { backgroundColor: PANEL, borderRadius: 4, padding: 8, marginBottom: 8 },
  fRow: { flexDirection: "row", marginBottom: 2.5 },
  fLabel: { width: 130, fontSize: 8, color: GREY },
  fValue: { flex: 1, fontSize: 8.5, fontWeight: 700 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 3, marginTop: 4 },
  th: { flexDirection: "row", backgroundColor: NAVY },
  thCell: { color: "#fff", fontSize: 8, fontWeight: 700, paddingVertical: 4, paddingHorizontal: 5 },
  tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE },
  td: { fontSize: 8.5, paddingVertical: 4, paddingHorizontal: 5 },
  right: { textAlign: "right" },
  amount: { marginTop: 8, alignSelf: "flex-end", flexDirection: "row", gap: 8, alignItems: "baseline" },
  sigRow: { flexDirection: "row", gap: 10, marginTop: 26 },
  sigBox: { flex: 1, alignItems: "center" },
  sigLine: { alignSelf: "stretch", borderTopWidth: 0.5, borderTopColor: "#9AA4B2", marginBottom: 4 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 4 },
  footText: { fontSize: 7, color: GREY },
});

export type PayReqPdfData = {
  number: string;
  createdAt: string;
  status: string;
  typeLabel: string;
  requester: string;
  department: string;
  costCenter: string;
  payee: { name: string; bankName?: string | null; bankAccount?: string | null; method: string };
  reason: string;
  dueDate?: string | null;
  lines: { no: number; description: string; amount: string }[];
  total: string;
  signatures: { name: string; meaning: string; signedAt: string; reason?: string | null }[];
};

function Bi({ en, vn }: { en: string; vn: string }) {
  return (
    <Text style={s.fLabel}>
      {en} <Text style={{ fontStyle: "italic" }}>· {vn}</Text>
    </Text>
  );
}

export function PayReqPdf({ d }: { d: PayReqPdfData }) {
  registerPdfFonts();
  const sigOf = (m: string) => d.signatures.filter((g) => g.meaning === m).slice(-1)[0];
  const blocks: { label: string; vn: string; sig?: { name: string; signedAt: string } }[] = [
    { label: "Requester", vn: "Người đề nghị", sig: sigOf("AUTHORED") ?? { name: d.requester, signedAt: "" } },
    { label: "Chief Accountant", vn: "Kế toán trưởng", sig: sigOf("VERIFIED") },
    { label: "Approved by", vn: "Người duyệt", sig: sigOf("APPROVED") },
  ];
  return (
    <Document title={d.number} author="Humiley Procurement Portal">
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
            <Text style={s.docNo}>{d.number}</Text>
            <Text style={s.docMeta}>HML-PAY · Rev 01.0 · {d.createdAt}</Text>
            <Text style={s.docMeta}>{d.status}</Text>
          </View>
        </View>

        <Text style={s.title}>PAYMENT REQUEST</Text>
        <Text style={s.titleVn}>Đề nghị thanh toán — {d.typeLabel}</Text>

        <View style={s.box}>
          <View style={s.fRow}><Bi en="Requester" vn="Người đề nghị" /><Text style={s.fValue}>{d.requester} — {d.department} / {d.costCenter}</Text></View>
          <View style={s.fRow}><Bi en="Payee" vn="Đơn vị thụ hưởng" /><Text style={s.fValue}>{d.payee.name}</Text></View>
          <View style={s.fRow}><Bi en="Bank / account" vn="Ngân hàng / Số TK" /><Text style={s.fValue}>{d.payee.bankName || "—"} · {d.payee.bankAccount || "—"}</Text></View>
          <View style={s.fRow}><Bi en="Method" vn="Hình thức" /><Text style={s.fValue}>{d.payee.method}</Text></View>
          {d.dueDate ? <View style={s.fRow}><Bi en="Due date" vn="Hạn thanh toán" /><Text style={s.fValue}>{d.dueDate}</Text></View> : null}
          <View style={s.fRow}><Bi en="Reason" vn="Lý do / nội dung" /><Text style={s.fValue}>{d.reason}</Text></View>
        </View>

        <View style={s.table}>
          <View style={s.th} fixed>
            <Text style={[s.thCell, { width: 26 }]}>#</Text>
            <Text style={[s.thCell, { flex: 1 }]}>Description · Diễn giải</Text>
            <Text style={[s.thCell, { width: 120 }, s.right]}>Amount · Số tiền</Text>
          </View>
          {d.lines.map((l) => (
            <View style={s.tr} key={l.no} wrap={false}>
              <Text style={[s.td, { width: 26 }]}>{l.no}</Text>
              <Text style={[s.td, { flex: 1 }]}>{l.description}</Text>
              <Text style={[s.td, { width: 120 }, s.right]}>{l.amount}</Text>
            </View>
          ))}
        </View>

        <View style={s.amount}>
          <Text style={{ fontSize: 9, color: GREY }}>TOTAL · Tổng cộng</Text>
          <Text style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{d.total}</Text>
        </View>

        <View style={s.sigRow}>
          {blocks.map((b) => (
            <View style={s.sigBox} key={b.label}>
              <View style={{ height: 42 }} />
              <View style={s.sigLine} />
              <Text style={{ fontSize: 8.5, fontWeight: 700 }}>{b.label}</Text>
              <Text style={{ fontSize: 7.5, color: GREY, fontStyle: "italic" }}>{b.vn}</Text>
              {b.sig?.name ? <Text style={{ fontSize: 8, color: NAVY, marginTop: 2, fontWeight: 700 }}>{b.sig.name}</Text> : null}
              {b.sig?.signedAt ? <Text style={{ fontSize: 7, color: GREY }}>{b.sig.signedAt}</Text> : null}
            </View>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footText}>Humiley Procurement Portal — payment request voucher</Text>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `${d.number} · Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
