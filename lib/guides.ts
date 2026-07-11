/**
 * In-app "How it works" guides — a short overview + the step-by-step process for each module,
 * shown in a collapsible panel on the page (see components/shared/HowItWorks.tsx). Bilingual:
 * the panel renders `en` or `vn` by the active locale. Keep steps action-oriented and accurate
 * to the real workflow — this is the operator's contextual manual.
 */

export type GuideStep = { t: string; d: string };
export type GuideRole = { who: string; can: string };
export type Guide = {
  overview: string;
  steps: GuideStep[];
  roles?: GuideRole[];
  tips?: string[];
};
export type GuideBilingual = { en: Guide; vn: Guide };

export const GUIDES: Record<string, GuideBilingual> = {
  dashboard: {
    en: {
      overview:
        "The dashboard is your procure-to-pay cockpit: what is waiting for you, spend and budget health, and quick links into every module. It is the fastest way to see what needs action today.",
      steps: [
        { t: "Check “Waiting for me”", d: "Approvals assigned to you (requisitions, POs, vendors) appear first — clear these to keep procurement moving." },
        { t: "Watch budget & spend", d: "Committed vs. actual spend and budget usage tell you where money is going before it is spent." },
        { t: "Jump into a module", d: "Use the sidebar or the dashboard cards to open Requisitions, RFQs, Purchase Orders, Inventory and more." },
      ],
      tips: ["Anything with a number badge in the sidebar has items waiting for you."],
    },
    vn: {
      overview:
        "Bảng điều khiển là trung tâm mua sắm–thanh toán: việc đang chờ bạn, tình hình chi tiêu và ngân sách, cùng lối tắt vào mọi phân hệ. Đây là cách nhanh nhất để thấy việc cần xử lý hôm nay.",
      steps: [
        { t: "Xem “Đang chờ tôi”", d: "Các phê duyệt được giao cho bạn (yêu cầu mua, PO, nhà cung cấp) hiển thị đầu tiên — xử lý để công việc thông suốt." },
        { t: "Theo dõi ngân sách & chi tiêu", d: "Chi tiêu cam kết so với thực tế và mức dùng ngân sách cho biết dòng tiền đang đi đâu." },
        { t: "Mở một phân hệ", d: "Dùng thanh bên hoặc các thẻ để mở Yêu cầu mua, RFQ, Đơn mua, Tồn kho..." },
      ],
      tips: ["Mục nào có số trên thanh bên là đang có việc chờ bạn."],
    },
  },

  requisitions: {
    en: {
      overview:
        "A Purchase Requisition (PR) is the formal request to buy something. It captures what is needed, the budget line and the justification, then routes for approval by value band before any RFQ or PO is raised.",
      steps: [
        { t: "Create the PR", d: "Click New requisition, add line items (item, quantity, need-by date) and pick the cost centre / budget." },
        { t: "Submit for approval", d: "Submitting routes the PR by its total value — small values need one approval, larger values need two or three levels." },
        { t: "Approvers decide", d: "Each approver signs to approve or rejects with a reason (e-signature). A rejected PR returns to draft to fix and resubmit." },
        { t: "Convert once approved", d: "An approved PR can be turned into an RFQ (to get quotes) or straight into a Purchase Order." },
      ],
      roles: [
        { who: "Requester", can: "create and submit PRs, see their own" },
        { who: "Manager / Director", can: "approve or reject by value band" },
      ],
      tips: ["Fill the justification and budget line — approvers reject PRs that are not clearly costed."],
    },
    vn: {
      overview:
        "Yêu cầu mua hàng (PR) là đề nghị mua chính thức: ghi rõ nhu cầu, dòng ngân sách và lý do, sau đó chuyển phê duyệt theo hạn mức giá trị trước khi lập RFQ hoặc PO.",
      steps: [
        { t: "Tạo PR", d: "Bấm Tạo yêu cầu, thêm các dòng hàng (mặt hàng, số lượng, ngày cần) và chọn trung tâm chi phí / ngân sách." },
        { t: "Gửi phê duyệt", d: "Khi gửi, PR đi theo tổng giá trị — giá trị nhỏ cần một cấp, lớn hơn cần hai hoặc ba cấp." },
        { t: "Người duyệt quyết định", d: "Mỗi người ký để duyệt hoặc từ chối kèm lý do (chữ ký điện tử). PR bị từ chối quay về nháp để sửa và gửi lại." },
        { t: "Chuyển đổi khi được duyệt", d: "PR đã duyệt có thể chuyển thành RFQ (lấy báo giá) hoặc thành Đơn mua." },
      ],
      roles: [
        { who: "Người yêu cầu", can: "tạo và gửi PR, xem PR của mình" },
        { who: "Quản lý / Giám đốc", can: "duyệt hoặc từ chối theo hạn mức" },
      ],
      tips: ["Ghi rõ lý do và dòng ngân sách — người duyệt sẽ từ chối PR không rõ chi phí."],
    },
  },

  rfqs: {
    en: {
      overview:
        "A Request for Quotation (RFQ) collects competing prices from vendors for an approved requisition, so you can compare and award to the best offer with an audit trail.",
      steps: [
        { t: "Raise the RFQ", d: "Create an RFQ from an approved PR and add the vendors you want to invite (only approved vendors can be selected)." },
        { t: "Capture quotes", d: "Enter each vendor’s prices per line as their quotes come back." },
        { t: "Compare & award", d: "The comparison shows the cheapest per line; award to a vendor to create the Purchase Order." },
      ],
      tips: ["Invite at least three vendors where policy requires competitive quoting."],
    },
    vn: {
      overview:
        "Yêu cầu báo giá (RFQ) thu thập giá cạnh tranh từ các nhà cung cấp cho một PR đã duyệt, để bạn so sánh và trao thầu cho chào giá tốt nhất kèm dấu vết kiểm toán.",
      steps: [
        { t: "Lập RFQ", d: "Tạo RFQ từ PR đã duyệt và thêm nhà cung cấp muốn mời (chỉ chọn được nhà cung cấp đã duyệt)." },
        { t: "Nhập báo giá", d: "Nhập giá từng dòng theo báo giá của mỗi nhà cung cấp." },
        { t: "So sánh & trao thầu", d: "Bảng so sánh hiển thị giá rẻ nhất từng dòng; trao thầu để tạo Đơn mua." },
      ],
      tips: ["Mời ít nhất ba nhà cung cấp khi quy định yêu cầu chào giá cạnh tranh."],
    },
  },

  "purchase-orders": {
    en: {
      overview:
        "A Purchase Order (PO) is the binding order sent to a vendor. It is created from an awarded RFQ or an approved PR, approved by value band, then issued to the vendor and received against in the warehouse.",
      steps: [
        { t: "Create the PO", d: "Generate from an awarded RFQ or approved PR; confirm vendor, prices, delivery and the C/O form if importing." },
        { t: "Approve by value", d: "The PO routes for approval like a PR — each level signs off before it can be issued." },
        { t: "Issue to vendor", d: "An approved PO is issued (PDF) and becomes committed spend against the budget." },
        { t: "Receive goods", d: "When stock arrives, raise a Goods Receipt against the PO — this is step one of the 3-way match." },
      ],
      tips: ["Committed spend updates the budget the moment a PO is approved, not when it is paid."],
    },
    vn: {
      overview:
        "Đơn mua hàng (PO) là đơn đặt ràng buộc gửi nhà cung cấp. Tạo từ RFQ đã trao thầu hoặc PR đã duyệt, duyệt theo hạn mức, phát hành cho nhà cung cấp rồi nhận hàng tại kho.",
      steps: [
        { t: "Tạo PO", d: "Tạo từ RFQ đã trao thầu hoặc PR đã duyệt; xác nhận nhà cung cấp, giá, giao hàng và mẫu C/O nếu nhập khẩu." },
        { t: "Duyệt theo giá trị", d: "PO chuyển phê duyệt như PR — mỗi cấp ký trước khi phát hành." },
        { t: "Phát hành cho NCC", d: "PO đã duyệt được phát hành (PDF) và trở thành chi tiêu cam kết trên ngân sách." },
        { t: "Nhận hàng", d: "Khi hàng về, lập Phiếu nhập kho theo PO — bước một của đối chiếu 3 chiều." },
      ],
      tips: ["Chi tiêu cam kết cập nhật ngân sách ngay khi PO được duyệt, không phải khi thanh toán."],
    },
  },

  "goods-receipts": {
    en: {
      overview:
        "A Goods Receipt Note (GRN) records what actually arrived against a Purchase Order. It updates stock on hand, assigns lot numbers for traceability, and is the second leg of the 3-way match (PO ↔ GRN ↔ Invoice).",
      steps: [
        { t: "Receive against a PO", d: "Open the PO and record received quantities per line — you can receive partially over several deliveries." },
        { t: "Record lots & QC", d: "Enter lot numbers (and QC status where required); stock is now traceable end-to-end via the Scan / Trace tools." },
        { t: "Stock updates", d: "On-hand quantity and average cost update automatically for the receiving warehouse." },
        { t: "Enables 3-way match", d: "When the vendor invoice arrives, quantities are matched PO ↔ GRN ↔ Invoice before payment." },
      ],
      tips: ["Receive short if the delivery is incomplete — never over-receive to “tidy up” a PO."],
    },
    vn: {
      overview:
        "Phiếu nhập kho (GRN) ghi nhận hàng thực nhận theo Đơn mua. Nó cập nhật tồn kho, gán số lô để truy xuất, và là chân thứ hai của đối chiếu 3 chiều (PO ↔ GRN ↔ Hóa đơn).",
      steps: [
        { t: "Nhận theo PO", d: "Mở PO và ghi số lượng nhận từng dòng — có thể nhận từng phần qua nhiều đợt giao." },
        { t: "Ghi lô & QC", d: "Nhập số lô (và trạng thái QC nếu cần); hàng nay truy xuất được đầu-cuối qua công cụ Quét / Truy vết." },
        { t: "Cập nhật tồn", d: "Số lượng tồn và giá vốn bình quân của kho nhận tự động cập nhật." },
        { t: "Kích hoạt đối chiếu 3 chiều", d: "Khi có hóa đơn NCC, số lượng được đối chiếu PO ↔ GRN ↔ Hóa đơn trước khi thanh toán." },
      ],
      tips: ["Nhận thiếu nếu giao chưa đủ — không nhận dư để “làm gọn” PO."],
    },
  },

  invoices: {
    en: {
      overview:
        "The invoice is the vendor’s bill. The system runs a 3-way match — Purchase Order vs. Goods Receipt vs. Invoice — and only a matched (or explained) invoice can proceed to a payment request.",
      steps: [
        { t: "Enter the invoice", d: "Record the vendor invoice against its PO and attach the scanned bill." },
        { t: "3-way match", d: "The system compares ordered vs. received vs. invoiced quantities and prices; matches are flagged green, gaps are flagged for review." },
        { t: "Resolve exceptions", d: "Price or quantity variances beyond tolerance must be explained or corrected before the invoice can pass." },
        { t: "Send to payment", d: "A passed invoice becomes a payment request for finance to schedule and pay." },
      ],
      tips: ["A missing Goods Receipt is the most common reason an invoice cannot match — receive first."],
    },
    vn: {
      overview:
        "Hóa đơn là chứng từ đòi tiền của nhà cung cấp. Hệ thống đối chiếu 3 chiều — Đơn mua vs. Nhập kho vs. Hóa đơn — và chỉ hóa đơn khớp (hoặc đã giải trình) mới được chuyển sang đề nghị thanh toán.",
      steps: [
        { t: "Nhập hóa đơn", d: "Ghi hóa đơn NCC theo PO và đính kèm bản scan." },
        { t: "Đối chiếu 3 chiều", d: "Hệ thống so sánh số lượng/giá đặt–nhận–hóa đơn; khớp thì báo xanh, lệch thì báo để rà soát." },
        { t: "Xử lý sai lệch", d: "Chênh lệch giá/số lượng vượt dung sai phải được giải trình hoặc sửa trước khi hóa đơn qua." },
        { t: "Chuyển thanh toán", d: "Hóa đơn đạt trở thành đề nghị thanh toán để tài chính lên lịch và chi." },
      ],
      tips: ["Thiếu Phiếu nhập kho là lý do phổ biến nhất khiến hóa đơn không khớp — hãy nhập kho trước."],
    },
  },

  "payment-requests": {
    en: {
      overview:
        "A payment request is the instruction to pay a vendor a matched invoice (or an approved advance). It is approved by value band, e-signed, then paid and archived — the last step of procure-to-pay.",
      steps: [
        { t: "Raise the request", d: "Create from a passed invoice or as an advance; set payee, amount, due date and attach the bill/invoice." },
        { t: "Approve & sign", d: "Approvers up the value band e-sign the request; finance sees the daily payment run by due date." },
        { t: "Mark paid", d: "Finance records the payment; the voucher + invoice are archived to SharePoint automatically." },
      ],
      roles: [
        { who: "Requester", can: "raise a payment request and see their own" },
        { who: "Manager / Finance / Director", can: "approve by value band" },
        { who: "Accountant", can: "run the payment and mark paid" },
      ],
      tips: ["An unsettled advance older than 30 days blocks new advances for the same person."],
    },
    vn: {
      overview:
        "Đề nghị thanh toán là chỉ thị chi trả cho nhà cung cấp theo hóa đơn đã khớp (hoặc tạm ứng đã duyệt). Duyệt theo hạn mức, ký điện tử, rồi chi và lưu trữ — bước cuối của mua sắm–thanh toán.",
      steps: [
        { t: "Lập đề nghị", d: "Tạo từ hóa đơn đã đạt hoặc dạng tạm ứng; đặt người nhận, số tiền, hạn chi và đính kèm hóa đơn." },
        { t: "Duyệt & ký", d: "Người duyệt theo hạn mức ký điện tử; tài chính thấy danh sách chi trong ngày theo hạn." },
        { t: "Đánh dấu đã chi", d: "Tài chính ghi nhận chi trả; chứng từ + hóa đơn tự lưu lên SharePoint." },
      ],
      roles: [
        { who: "Người yêu cầu", can: "lập đề nghị và xem của mình" },
        { who: "Quản lý / Tài chính / Giám đốc", can: "duyệt theo hạn mức" },
        { who: "Kế toán", can: "thực hiện chi và đánh dấu đã chi" },
      ],
      tips: ["Một khoản tạm ứng chưa quyết toán quá 30 ngày sẽ chặn tạm ứng mới của cùng người."],
    },
  },

  vendors: {
    en: {
      overview:
        "Every supplier is onboarded and approved before it can be used. A vendor moves Draft → Pending → Approved, can be Rejected back to draft, and an approved vendor can later be Blacklisted with a reason — which blocks it from any new RFQ or PO.",
      steps: [
        { t: "Create the vendor (Draft)", d: "Add the vendor’s legal name, tax code and bank details. It starts as a Draft — not yet usable." },
        { t: "Submit for approval (Pending)", d: "Submit the draft; it moves to Pending and appears in the Director’s approval queue." },
        { t: "Director approves or rejects", d: "In Approvals, a Director e-signs to Approve (vendor becomes usable) or Reject with a reason (returns to Draft to fix and resubmit)." },
        { t: "Blacklist when needed", d: "An Approved vendor can be Blacklisted — a reason is required. Blacklisting immediately blocks the vendor from being selected on any new RFQ or PO." },
      ],
      roles: [
        { who: "Purchaser", can: "create vendors and submit them for approval" },
        { who: "Director", can: "approve, reject, or blacklist (e-signed)" },
      ],
      tips: [
        "Rejecting sends the vendor back to Draft — it is not deleted; fix the issue and resubmit.",
        "Blacklisting never deletes history: existing POs stand, but no new business can be placed.",
        "Changing a vendor’s bank details triggers a separate Director call-back confirmation (dual control).",
      ],
    },
    vn: {
      overview:
        "Mọi nhà cung cấp phải được thiết lập và phê duyệt trước khi sử dụng. Trạng thái đi Nháp → Chờ duyệt → Đã duyệt, có thể bị Từ chối về nháp, và nhà cung cấp đã duyệt có thể bị Đưa vào danh sách đen kèm lý do — chặn khỏi mọi RFQ/PO mới.",
      steps: [
        { t: "Tạo nhà cung cấp (Nháp)", d: "Nhập tên pháp lý, mã số thuế và thông tin ngân hàng. Bắt đầu ở trạng thái Nháp — chưa dùng được." },
        { t: "Gửi phê duyệt (Chờ duyệt)", d: "Gửi bản nháp; chuyển sang Chờ duyệt và xuất hiện trong hàng chờ của Giám đốc." },
        { t: "Giám đốc duyệt hoặc từ chối", d: "Trong Phê duyệt, Giám đốc ký điện tử để Duyệt (dùng được) hoặc Từ chối kèm lý do (quay về Nháp để sửa và gửi lại)." },
        { t: "Đưa vào danh sách đen khi cần", d: "Nhà cung cấp Đã duyệt có thể bị Đưa vào danh sách đen — bắt buộc nêu lý do. Việc này lập tức chặn chọn nhà cung cấp trên mọi RFQ/PO mới." },
      ],
      roles: [
        { who: "Nhân viên mua hàng", can: "tạo nhà cung cấp và gửi phê duyệt" },
        { who: "Giám đốc", can: "duyệt, từ chối hoặc đưa vào danh sách đen (ký điện tử)" },
      ],
      tips: [
        "Từ chối sẽ đưa nhà cung cấp về Nháp — không bị xóa; sửa lỗi rồi gửi lại.",
        "Danh sách đen không xóa lịch sử: PO hiện có vẫn hiệu lực, nhưng không đặt thêm giao dịch mới.",
        "Thay đổi thông tin ngân hàng của nhà cung cấp sẽ kích hoạt xác nhận gọi lại của Giám đốc (kiểm soát kép).",
      ],
    },
  },

  inventory: {
    en: {
      overview:
        "Inventory tracks what you physically hold: stock on hand and its value by warehouse and category, items below their reorder point, goods in transit, and slow movers. The charts turn the live balances into a Power-BI-style overview.",
      steps: [
        { t: "Read the overview", d: "KPI cards and charts show total stock value, value by category/warehouse, below-minimum items and in-transit transfers at a glance." },
        { t: "Act on reorder alerts", d: "Items below their reorder point are flagged — open Reorder to raise the requisitions that top them up." },
        { t: "Move & count stock", d: "Use Issues (consume), Transfers (warehouse-to-warehouse) and Stock Counts (physical count vs. system) to keep balances accurate." },
        { t: "Trace any item", d: "Every receipt carries a lot number — use Scan / Trace to follow a lot from receipt to issue." },
      ],
      tips: ["Stock value uses moving-average cost, updated on every receipt — it is always current."],
    },
    vn: {
      overview:
        "Tồn kho theo dõi hàng thực có: số lượng và giá trị tồn theo kho và nhóm hàng, mặt hàng dưới điểm đặt lại, hàng đang chuyển, và hàng chậm luân chuyển. Biểu đồ biến số dư tức thời thành bảng tổng quan kiểu Power BI.",
      steps: [
        { t: "Đọc tổng quan", d: "Thẻ KPI và biểu đồ hiển thị tổng giá trị tồn, giá trị theo nhóm/kho, hàng dưới mức tối thiểu và hàng đang chuyển trong nháy mắt." },
        { t: "Xử lý cảnh báo đặt lại", d: "Hàng dưới điểm đặt lại được gắn cờ — mở Đặt lại để lập yêu cầu mua bổ sung." },
        { t: "Xuất, chuyển & kiểm kê", d: "Dùng Xuất kho, Chuyển kho và Kiểm kê (đếm thực tế vs. hệ thống) để giữ số liệu chính xác." },
        { t: "Truy vết mặt hàng", d: "Mỗi lần nhập đều có số lô — dùng Quét / Truy vết để theo dõi lô từ nhập đến xuất." },
      ],
      tips: ["Giá trị tồn dùng giá vốn bình quân di động, cập nhật mỗi lần nhập — luôn là số hiện thời."],
    },
  },

  scan: {
    en: {
      overview:
        "The Scan Hub is the mobile-first way to look anything up by its barcode or QR. A handheld scanner (or your phone camera) types the code and hits Enter — document codes jump straight to the document; a lot or item code shows live stock and its full history.",
      steps: [
        { t: "Scan or type a code", d: "Point a keyboard-wedge scanner at a label, or type the code and press Enter. The topbar search also lands here." },
        { t: "Documents open directly", d: "A PR, PO, GRN, invoice or transfer barcode opens that document immediately — no searching." },
        { t: "Items & lots show stock", d: "An item or lot code shows on-hand quantity, the receiving warehouse and recent movements, with a one-tap Trace link." },
        { t: "Trace end-to-end", d: "From a lot, Trace follows it from goods receipt through every issue and transfer — full genealogy for QA and recalls." },
      ],
      tips: [
        "Any USB/Bluetooth barcode scanner works — it just types the code and an Enter, no setup.",
        "Labels are printed from Inventory → Labels, so every item and lot already carries a scannable code.",
      ],
    },
    vn: {
      overview:
        "Trung tâm Quét là cách ưu tiên di động để tra cứu mọi thứ bằng mã vạch hoặc QR. Máy quét cầm tay (hoặc camera điện thoại) nhập mã và Enter — mã chứng từ mở thẳng chứng từ; mã lô hoặc mặt hàng hiển thị tồn kho và toàn bộ lịch sử.",
      steps: [
        { t: "Quét hoặc gõ mã", d: "Chĩa máy quét vào nhãn, hoặc gõ mã và nhấn Enter. Ô tìm kiếm trên thanh trên cùng cũng dẫn về đây." },
        { t: "Chứng từ mở trực tiếp", d: "Mã vạch của PR, PO, GRN, hóa đơn hay phiếu chuyển sẽ mở ngay chứng từ đó — khỏi tìm." },
        { t: "Mặt hàng & lô hiện tồn", d: "Mã mặt hàng hoặc lô hiển thị số tồn, kho nhận và biến động gần đây, kèm liên kết Truy vết một chạm." },
        { t: "Truy vết đầu-cuối", d: "Từ một lô, Truy vết theo dõi nó từ khi nhập qua mọi lần xuất và chuyển — phả hệ đầy đủ cho QA và thu hồi." },
      ],
      tips: [
        "Mọi máy quét mã vạch USB/Bluetooth đều dùng được — chỉ cần nhập mã và Enter, không cần cài đặt.",
        "Nhãn được in ở Tồn kho → Nhãn, nên mỗi mặt hàng và lô đều đã có mã quét được.",
      ],
    },
  },

  "hs-codes": {
    en: {
      overview:
        "The HS Code Explorer helps you find and verify the right customs classification. Search the curated HS 2022 catalogue, browse the full 21-section / 97-chapter nomenclature, and check duty and Certificate-of-Origin routes for the codes Humiley imports.",
      steps: [
        { t: "Search or filter", d: "Search by code, description (EN/VN) or keyword; narrow by category, section, or show only codes Humiley actively trades." },
        { t: "Browse by chapter", d: "The Chapter index view lets you drill the full nomenclature by section and chapter to locate the right heading." },
        { t: "Open a code", d: "A code shows its duty-by-C/O-form matrix and linked catalogue items. Reference codes show “Confirm rate” — verify against the live tariff." },
        { t: "Import the official tariff", d: "Admins can import the full General Department of Vietnam Customs tariff by CSV (upsert by code, safe to re-run)." },
      ],
      tips: ["Only the “Traded by Humiley” codes carry researched duty — always confirm a reference code before you rely on a rate."],
    },
    vn: {
      overview:
        "Trình tra HS giúp bạn tìm và xác minh đúng mã phân loại hải quan. Tra danh mục HS 2022 đã tuyển chọn, duyệt toàn bộ 21 phần / 97 chương, và kiểm tra thuế cùng tuyến C/O cho các mã Humiley nhập.",
      steps: [
        { t: "Tìm hoặc lọc", d: "Tìm theo mã, mô tả (EN/VN) hoặc từ khóa; lọc theo nhóm, phần, hoặc chỉ hiện mã Humiley đang nhập." },
        { t: "Duyệt theo chương", d: "Chế độ Mục lục chương cho phép đi sâu toàn bộ danh mục theo phần và chương để tìm đúng nhóm." },
        { t: "Mở một mã", d: "Mã hiển thị ma trận thuế theo mẫu C/O và mặt hàng liên kết. Mã tham chiếu hiện “Xác nhận thuế” — hãy đối chiếu biểu thuế hiện hành." },
        { t: "Nhập biểu thuế chính thức", d: "Quản trị có thể nhập toàn bộ biểu thuế Tổng cục Hải quan bằng CSV (đối chiếu theo mã, chạy lại an toàn)." },
      ],
      tips: ["Chỉ mã “Humiley nhập khẩu” có thuế đã nghiên cứu — luôn xác nhận mã tham chiếu trước khi sử dụng."],
    },
  },
};
