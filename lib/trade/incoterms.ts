/**
 * §20 Incoterms 2020 book — structured reference data (not free text) so the page renders
 * tables. B = buyer pays/risks, S = seller. Bilingual summaries; VN import notes included.
 */
export type IncotermInfo = {
  code: string;
  nameEn: string;
  nameVn: string;
  mode: "any" | "sea";
  summaryEn: string;
  summaryVn: string;
  // responsibility: seller (S) or buyer (B)
  exportClearance: "S" | "B";
  mainCarriage: "S" | "B";
  insurance: "S" | "B" | "-";
  importClearance: "S" | "B";
  importDuties: "S" | "B";
  riskTransferEn: string;
  buyerNoteEn: string;
  buyerNoteVn: string;
};

export const INCOTERMS_BOOK: IncotermInfo[] = [
  {
    code: "EXW", nameEn: "Ex Works", nameVn: "Giao tại xưởng", mode: "any",
    summaryEn: "Seller makes goods available at their premises; buyer handles everything from pickup.",
    summaryVn: "Người bán giao hàng tại cơ sở của mình; người mua lo toàn bộ từ khâu nhận hàng.",
    exportClearance: "B", mainCarriage: "B", insurance: "-", importClearance: "B", importDuties: "B",
    riskTransferEn: "At the seller's premises, when goods are placed at the buyer's disposal.",
    buyerNoteEn: "Maximum obligation for the buyer — you arrange export clearance in the seller's country; avoid for China imports unless you have a local agent.",
    buyerNoteVn: "Nghĩa vụ tối đa cho người mua — bạn phải làm thủ tục xuất khẩu tại nước người bán; nên tránh với hàng Trung Quốc trừ khi có đại lý.",
  },
  {
    code: "FCA", nameEn: "Free Carrier", nameVn: "Giao cho người vận tải", mode: "any",
    summaryEn: "Seller delivers to the carrier nominated by the buyer at a named place, export-cleared.",
    summaryVn: "Người bán giao cho người vận tải do người mua chỉ định, đã thông quan xuất khẩu.",
    exportClearance: "S", mainCarriage: "B", insurance: "-", importClearance: "B", importDuties: "B",
    riskTransferEn: "When goods are handed to the buyer's nominated carrier at the named place.",
    buyerNoteEn: "The recommended replacement for EXW — the seller clears export; works for all transport modes.",
    buyerNoteVn: "Khuyến nghị thay cho EXW — người bán làm thủ tục xuất khẩu; dùng được mọi phương thức vận tải.",
  },
  {
    code: "CPT", nameEn: "Carriage Paid To", nameVn: "Cước phí trả tới", mode: "any",
    summaryEn: "Seller pays freight to the named destination; risk passes at the first carrier.",
    summaryVn: "Người bán trả cước tới đích; rủi ro chuyển khi giao cho người vận tải đầu tiên.",
    exportClearance: "S", mainCarriage: "S", insurance: "-", importClearance: "B", importDuties: "B",
    riskTransferEn: "When goods are handed to the FIRST carrier — before the main carriage.",
    buyerNoteEn: "Freight is in the price, but transit risk is yours — consider cargo insurance.",
    buyerNoteVn: "Cước đã trong giá, nhưng rủi ro vận chuyển thuộc về bạn — nên mua bảo hiểm hàng hóa.",
  },
  {
    code: "CIP", nameEn: "Carriage & Insurance Paid To", nameVn: "Cước phí và bảo hiểm trả tới", mode: "any",
    summaryEn: "Like CPT plus the seller must insure the cargo (all-risks, 110% of value).",
    summaryVn: "Như CPT, thêm nghĩa vụ người bán mua bảo hiểm (mọi rủi ro, 110% trị giá).",
    exportClearance: "S", mainCarriage: "S", insurance: "S", importClearance: "B", importDuties: "B",
    riskTransferEn: "At the first carrier, but the seller's insurance covers the buyer in transit.",
    buyerNoteEn: "Good default for containerized imports when you want the seller to insure.",
    buyerNoteVn: "Lựa chọn tốt cho hàng container khi muốn người bán chịu bảo hiểm.",
  },
  {
    code: "DAP", nameEn: "Delivered At Place", nameVn: "Giao tại nơi đến", mode: "any",
    summaryEn: "Seller delivers to the named destination ready for unloading; buyer clears import.",
    summaryVn: "Người bán giao đến địa điểm chỉ định, sẵn sàng dỡ; người mua thông quan nhập khẩu.",
    exportClearance: "S", mainCarriage: "S", insurance: "-", importClearance: "B", importDuties: "B",
    riskTransferEn: "At the named destination, on the arriving transport, ready for unloading.",
    buyerNoteEn: "Common for domestic + regional supply. You still pay import duty/VAT on imports.",
    buyerNoteVn: "Phổ biến cho giao nội địa + khu vực. Với hàng nhập bạn vẫn nộp thuế NK/GTGT.",
  },
  {
    code: "DPU", nameEn: "Delivered at Place Unloaded", nameVn: "Giao tại nơi đến, đã dỡ", mode: "any",
    summaryEn: "Only term where the seller unloads. Buyer clears import.",
    summaryVn: "Điều kiện duy nhất người bán phải dỡ hàng. Người mua thông quan nhập khẩu.",
    exportClearance: "S", mainCarriage: "S", insurance: "-", importClearance: "B", importDuties: "B",
    riskTransferEn: "After unloading at the named place.",
    buyerNoteEn: "Use when the seller controls unloading equipment at the destination (e.g. site delivery).",
    buyerNoteVn: "Dùng khi người bán chủ động thiết bị dỡ hàng tại đích (VD giao công trường).",
  },
  {
    code: "DDP", nameEn: "Delivered Duty Paid", nameVn: "Giao đã nộp thuế", mode: "any",
    summaryEn: "Seller does everything including import clearance and duties.",
    summaryVn: "Người bán lo toàn bộ, gồm cả thông quan nhập khẩu và thuế.",
    exportClearance: "S", mainCarriage: "S", insurance: "-", importClearance: "S", importDuties: "S",
    riskTransferEn: "At the named destination, import-cleared, ready for unloading.",
    buyerNoteEn: "Maximum obligation for the seller; note VN import VAT paid by the seller is hard for you to deduct — prefer DAP + self-clearance.",
    buyerNoteVn: "Nghĩa vụ tối đa của người bán; lưu ý VAT nhập khẩu do người bán nộp khó khấu trừ — nên dùng DAP và tự thông quan.",
  },
  {
    code: "FAS", nameEn: "Free Alongside Ship", nameVn: "Giao dọc mạn tàu", mode: "sea",
    summaryEn: "Seller places goods alongside the vessel at the named port; buyer loads and ships.",
    summaryVn: "Người bán đặt hàng dọc mạn tàu tại cảng đi; người mua bốc và vận chuyển.",
    exportClearance: "S", mainCarriage: "B", insurance: "-", importClearance: "B", importDuties: "B",
    riskTransferEn: "Alongside the ship at the port of shipment.",
    buyerNoteEn: "Bulk/break-bulk sea cargo only — rarely used for containers.",
    buyerNoteVn: "Chỉ dùng hàng rời đường biển — hiếm dùng cho container.",
  },
  {
    code: "FOB", nameEn: "Free On Board", nameVn: "Giao lên tàu", mode: "sea",
    summaryEn: "Seller loads the goods on board at the port of shipment, export-cleared.",
    summaryVn: "Người bán giao hàng lên tàu tại cảng đi, đã thông quan xuất khẩu.",
    exportClearance: "S", mainCarriage: "B", insurance: "-", importClearance: "B", importDuties: "B",
    riskTransferEn: "When goods are on board the vessel at the port of shipment.",
    buyerNoteEn: "The classic China-import term — you book the sea freight; customs value = FOB + freight + insurance.",
    buyerNoteVn: "Điều kiện nhập hàng Trung Quốc kinh điển — bạn đặt cước biển; trị giá tính thuế = FOB + cước + bảo hiểm.",
  },
  {
    code: "CFR", nameEn: "Cost and Freight", nameVn: "Tiền hàng và cước", mode: "sea",
    summaryEn: "Seller pays sea freight to the destination port; risk passes on board at origin.",
    summaryVn: "Người bán trả cước biển tới cảng đích; rủi ro chuyển khi hàng lên tàu tại cảng đi.",
    exportClearance: "S", mainCarriage: "S", insurance: "-", importClearance: "B", importDuties: "B",
    riskTransferEn: "On board at the port of shipment — despite the seller paying freight.",
    buyerNoteEn: "Insure the voyage yourself — risk is yours from loading.",
    buyerNoteVn: "Tự mua bảo hiểm chặng biển — rủi ro thuộc về bạn từ khi bốc hàng.",
  },
  {
    code: "CIF", nameEn: "Cost, Insurance & Freight", nameVn: "Tiền hàng, bảo hiểm và cước", mode: "sea",
    summaryEn: "Like CFR plus the seller insures (minimum cover, 110% of value).",
    summaryVn: "Như CFR, thêm người bán mua bảo hiểm (mức tối thiểu, 110% trị giá).",
    exportClearance: "S", mainCarriage: "S", insurance: "S", importClearance: "B", importDuties: "B",
    riskTransferEn: "On board at the port of shipment; the seller's policy covers the voyage.",
    buyerNoteEn: "VN customs value for sea imports is the CIF value — duty computes directly on the invoice for CIF terms.",
    buyerNoteVn: "Trị giá hải quan hàng biển VN là trị giá CIF — với điều kiện CIF thuế tính thẳng trên hóa đơn.",
  },
];
