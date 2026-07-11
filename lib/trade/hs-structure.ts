/**
 * Harmonized System (HS 2022) nomenclature backbone — the 21 Sections and 97 Chapters.
 * This structure is stable, authoritative WCO/Vietnam nomenclature and is used to let the
 * Procurement team browse and drill down by chapter, and to derive the section/chapter/heading
 * of any code without storing them. Six- and eight-digit sub-lines live in the database
 * (curated set + CSV import of the official General Department of Vietnam Customs tariff).
 */

export type HsSection = {
  no: number;
  roman: string;
  en: string;
  vn: string;
  from: number; // first chapter
  to: number; // last chapter
};

export type HsChapter = {
  ch: number;
  en: string;
  vn: string;
};

export const HS_SECTIONS: HsSection[] = [
  { no: 1, roman: "I", en: "Live animals; animal products", vn: "Động vật sống; sản phẩm động vật", from: 1, to: 5 },
  { no: 2, roman: "II", en: "Vegetable products", vn: "Sản phẩm thực vật", from: 6, to: 14 },
  { no: 3, roman: "III", en: "Animal, vegetable or microbial fats and oils", vn: "Chất béo và dầu động vật, thực vật hoặc vi sinh vật", from: 15, to: 15 },
  { no: 4, roman: "IV", en: "Prepared foodstuffs; beverages, spirits and vinegar; tobacco", vn: "Thực phẩm chế biến; đồ uống, rượu và giấm; thuốc lá", from: 16, to: 24 },
  { no: 5, roman: "V", en: "Mineral products", vn: "Khoáng sản", from: 25, to: 27 },
  { no: 6, roman: "VI", en: "Products of the chemical or allied industries", vn: "Sản phẩm của ngành công nghiệp hóa chất hoặc liên quan", from: 28, to: 38 },
  { no: 7, roman: "VII", en: "Plastics and rubber and articles thereof", vn: "Plastic và cao su và các sản phẩm từ chúng", from: 39, to: 40 },
  { no: 8, roman: "VIII", en: "Raw hides, skins, leather, furskins; saddlery; travel goods", vn: "Da sống, da thuộc, da lông; yên cương; hàng du lịch", from: 41, to: 43 },
  { no: 9, roman: "IX", en: "Wood, cork, straw; charcoal; basketware", vn: "Gỗ, lie, rơm; than củi; hàng đan lát", from: 44, to: 46 },
  { no: 10, roman: "X", en: "Pulp of wood; paper and paperboard and articles thereof", vn: "Bột giấy; giấy và bìa và các sản phẩm từ chúng", from: 47, to: 49 },
  { no: 11, roman: "XI", en: "Textiles and textile articles", vn: "Nguyên liệu dệt và các sản phẩm dệt", from: 50, to: 63 },
  { no: 12, roman: "XII", en: "Footwear, headgear, umbrellas; artificial flowers", vn: "Giày dép, mũ, ô dù; hoa nhân tạo", from: 64, to: 67 },
  { no: 13, roman: "XIII", en: "Articles of stone, plaster, cement, asbestos; ceramic; glass", vn: "Sản phẩm bằng đá, thạch cao, xi măng, amiăng; gốm sứ; thủy tinh", from: 68, to: 70 },
  { no: 14, roman: "XIV", en: "Pearls, precious stones and metals; jewellery; coin", vn: "Ngọc trai, đá quý và kim loại quý; đồ trang sức; tiền kim loại", from: 71, to: 71 },
  { no: 15, roman: "XV", en: "Base metals and articles of base metal", vn: "Kim loại cơ bản và các sản phẩm bằng kim loại cơ bản", from: 72, to: 83 },
  { no: 16, roman: "XVI", en: "Machinery and mechanical appliances; electrical equipment", vn: "Máy móc và thiết bị cơ khí; thiết bị điện", from: 84, to: 85 },
  { no: 17, roman: "XVII", en: "Vehicles, aircraft, vessels and associated transport equipment", vn: "Phương tiện, máy bay, tàu thuyền và thiết bị vận tải liên quan", from: 86, to: 89 },
  { no: 18, roman: "XVIII", en: "Optical, measuring, medical instruments; clocks; musical instruments", vn: "Dụng cụ quang học, đo lường, y tế; đồng hồ; nhạc cụ", from: 90, to: 92 },
  { no: 19, roman: "XIX", en: "Arms and ammunition; parts and accessories thereof", vn: "Vũ khí và đạn dược; bộ phận và phụ kiện", from: 93, to: 93 },
  { no: 20, roman: "XX", en: "Miscellaneous manufactured articles", vn: "Các mặt hàng chế tạo khác", from: 94, to: 96 },
  { no: 21, roman: "XXI", en: "Works of art, collectors' pieces and antiques", vn: "Tác phẩm nghệ thuật, đồ sưu tầm và đồ cổ", from: 97, to: 97 },
];

export const HS_CHAPTERS: HsChapter[] = [
  { ch: 1, en: "Live animals", vn: "Động vật sống" },
  { ch: 2, en: "Meat and edible meat offal", vn: "Thịt và phụ phẩm ăn được sau giết mổ" },
  { ch: 3, en: "Fish, crustaceans, molluscs and other aquatic invertebrates", vn: "Cá, động vật giáp xác, thân mềm và thủy sinh không xương sống khác" },
  { ch: 4, en: "Dairy produce; eggs; honey; edible animal products, nes", vn: "Sản phẩm bơ sữa; trứng; mật ong; sản phẩm động vật ăn được khác" },
  { ch: 5, en: "Products of animal origin, nes", vn: "Sản phẩm gốc động vật, chưa được chi tiết ở nơi khác" },
  { ch: 6, en: "Live trees and other plants; cut flowers", vn: "Cây sống và cây trồng khác; hoa cắt cành" },
  { ch: 7, en: "Edible vegetables and certain roots and tubers", vn: "Rau và một số loại củ, rễ ăn được" },
  { ch: 8, en: "Edible fruit and nuts; peel of citrus fruit or melons", vn: "Quả và quả hạch ăn được; vỏ quả thuộc chi cam quýt hoặc dưa" },
  { ch: 9, en: "Coffee, tea, maté and spices", vn: "Cà phê, chè, chè Paragoay và gia vị" },
  { ch: 10, en: "Cereals", vn: "Ngũ cốc" },
  { ch: 11, en: "Products of the milling industry; malt; starches", vn: "Sản phẩm xay xát; malt; tinh bột" },
  { ch: 12, en: "Oil seeds; miscellaneous grains, seeds and fruit; fodder", vn: "Hạt có dầu; các loại hạt, quả khác; thức ăn gia súc" },
  { ch: 13, en: "Lac; gums, resins and other vegetable saps and extracts", vn: "Nhựa cánh kiến đỏ; gôm, nhựa và chiết xuất thực vật khác" },
  { ch: 14, en: "Vegetable plaiting materials; vegetable products, nes", vn: "Vật liệu tết bện; sản phẩm thực vật khác" },
  { ch: 15, en: "Animal, vegetable or microbial fats and oils; waxes", vn: "Chất béo, dầu động/thực vật hoặc vi sinh vật; sáp" },
  { ch: 16, en: "Preparations of meat, fish or aquatic invertebrates", vn: "Chế phẩm từ thịt, cá hoặc thủy sản không xương sống" },
  { ch: 17, en: "Sugars and sugar confectionery", vn: "Đường và bánh kẹo đường" },
  { ch: 18, en: "Cocoa and cocoa preparations", vn: "Ca cao và chế phẩm từ ca cao" },
  { ch: 19, en: "Preparations of cereals, flour, starch or milk; pastry", vn: "Chế phẩm từ ngũ cốc, bột, tinh bột hoặc sữa; bánh" },
  { ch: 20, en: "Preparations of vegetables, fruit, nuts or other plant parts", vn: "Chế phẩm từ rau, quả, quả hạch hoặc phần khác của cây" },
  { ch: 21, en: "Miscellaneous edible preparations", vn: "Chế phẩm ăn được khác" },
  { ch: 22, en: "Beverages, spirits and vinegar", vn: "Đồ uống, rượu và giấm" },
  { ch: 23, en: "Residues and waste from the food industries; animal fodder", vn: "Phế liệu và phế thải từ ngành thực phẩm; thức ăn gia súc" },
  { ch: 24, en: "Tobacco and manufactured tobacco substitutes", vn: "Thuốc lá và nguyên liệu thay thế thuốc lá" },
  { ch: 25, en: "Salt; sulphur; earths and stone; lime and cement", vn: "Muối; lưu huỳnh; đất và đá; vôi và xi măng" },
  { ch: 26, en: "Ores, slag and ash", vn: "Quặng, xỉ và tro" },
  { ch: 27, en: "Mineral fuels, oils and products of their distillation", vn: "Nhiên liệu khoáng, dầu khoáng và sản phẩm chưng cất" },
  { ch: 28, en: "Inorganic chemicals; compounds of precious/rare-earth metals", vn: "Hóa chất vô cơ; hợp chất của kim loại quý, đất hiếm" },
  { ch: 29, en: "Organic chemicals", vn: "Hóa chất hữu cơ" },
  { ch: 30, en: "Pharmaceutical products", vn: "Dược phẩm" },
  { ch: 31, en: "Fertilisers", vn: "Phân bón" },
  { ch: 32, en: "Tanning/dyeing extracts; dyes, pigments, paints, varnishes, inks", vn: "Chất chiết thuộc da/nhuộm; thuốc nhuộm, sơn, vécni, mực" },
  { ch: 33, en: "Essential oils; perfumery, cosmetic or toilet preparations", vn: "Tinh dầu; nước hoa, mỹ phẩm hoặc chế phẩm vệ sinh" },
  { ch: 34, en: "Soap, surface-active agents, lubricants, waxes, candles", vn: "Xà phòng, chất hoạt động bề mặt, chất bôi trơn, sáp, nến" },
  { ch: 35, en: "Albuminoidal substances; modified starches; glues; enzymes", vn: "Chất anbumin; tinh bột biến tính; keo dán; enzym" },
  { ch: 36, en: "Explosives; pyrotechnics; matches; combustible preparations", vn: "Chất nổ; pháo hoa; diêm; chế phẩm dễ cháy" },
  { ch: 37, en: "Photographic or cinematographic goods", vn: "Vật liệu nhiếp ảnh hoặc điện ảnh" },
  { ch: 38, en: "Miscellaneous chemical products", vn: "Các sản phẩm hóa chất khác" },
  { ch: 39, en: "Plastics and articles thereof", vn: "Plastic và các sản phẩm bằng plastic" },
  { ch: 40, en: "Rubber and articles thereof", vn: "Cao su và các sản phẩm bằng cao su" },
  { ch: 41, en: "Raw hides and skins (other than furskins) and leather", vn: "Da sống (trừ da lông) và da thuộc" },
  { ch: 42, en: "Articles of leather; saddlery; travel goods, handbags", vn: "Sản phẩm bằng da; yên cương; hàng du lịch, túi xách" },
  { ch: 43, en: "Furskins and artificial fur; manufactures thereof", vn: "Da lông và da lông nhân tạo; sản phẩm từ chúng" },
  { ch: 44, en: "Wood and articles of wood; wood charcoal", vn: "Gỗ và các sản phẩm bằng gỗ; than củi" },
  { ch: 45, en: "Cork and articles of cork", vn: "Lie và các sản phẩm bằng lie" },
  { ch: 46, en: "Manufactures of straw or other plaiting materials; basketware", vn: "Sản phẩm từ rơm, vật liệu tết bện; hàng đan lát" },
  { ch: 47, en: "Pulp of wood; recovered paper or paperboard", vn: "Bột giấy từ gỗ; giấy hoặc bìa thu hồi" },
  { ch: 48, en: "Paper and paperboard; articles of paper pulp", vn: "Giấy và bìa; sản phẩm từ bột giấy" },
  { ch: 49, en: "Printed books, newspapers, pictures; manuscripts, plans", vn: "Sách in, báo, tranh ảnh; bản thảo, bản vẽ" },
  { ch: 50, en: "Silk", vn: "Tơ tằm" },
  { ch: 51, en: "Wool, fine or coarse animal hair; horsehair yarn and fabric", vn: "Lông cừu, lông động vật; sợi và vải từ lông đuôi ngựa" },
  { ch: 52, en: "Cotton", vn: "Bông" },
  { ch: 53, en: "Other vegetable textile fibres; paper yarn and fabrics", vn: "Xơ dệt gốc thực vật khác; sợi giấy và vải" },
  { ch: 54, en: "Man-made filaments; strip of man-made textile materials", vn: "Sợi filament nhân tạo; dải vật liệu dệt nhân tạo" },
  { ch: 55, en: "Man-made staple fibres", vn: "Xơ sợi staple nhân tạo" },
  { ch: 56, en: "Wadding, felt and nonwovens; twine, cordage, ropes and cables", vn: "Mền xơ, phớt và vải không dệt; dây xe, thừng, chão và cáp" },
  { ch: 57, en: "Carpets and other textile floor coverings", vn: "Thảm và các loại hàng dệt trải sàn khác" },
  { ch: 58, en: "Special woven fabrics; lace; tapestries; embroidery", vn: "Vải dệt thoi đặc biệt; ren; thảm trang trí; hàng thêu" },
  { ch: 59, en: "Impregnated/coated textile fabrics; industrial textile articles", vn: "Vải dệt đã ngâm tẩm/tráng phủ; hàng dệt dùng trong công nghiệp" },
  { ch: 60, en: "Knitted or crocheted fabrics", vn: "Vải dệt kim hoặc móc" },
  { ch: 61, en: "Articles of apparel, knitted or crocheted", vn: "Quần áo và hàng may mặc, dệt kim hoặc móc" },
  { ch: 62, en: "Articles of apparel, not knitted or crocheted", vn: "Quần áo và hàng may mặc, không dệt kim hoặc móc" },
  { ch: 63, en: "Other made-up textile articles; worn clothing; rags", vn: "Hàng dệt đã hoàn thiện khác; quần áo cũ; vải vụn" },
  { ch: 64, en: "Footwear, gaiters and the like; parts thereof", vn: "Giày, dép, ghệt và sản phẩm tương tự; bộ phận" },
  { ch: 65, en: "Headgear and parts thereof", vn: "Mũ và các bộ phận của mũ" },
  { ch: 66, en: "Umbrellas, walking-sticks, whips and parts thereof", vn: "Ô, dù, ba toong, roi và bộ phận" },
  { ch: 67, en: "Prepared feathers; artificial flowers; articles of human hair", vn: "Lông vũ chế biến; hoa nhân tạo; sản phẩm từ tóc người" },
  { ch: 68, en: "Articles of stone, plaster, cement, asbestos, mica", vn: "Sản phẩm bằng đá, thạch cao, xi măng, amiăng, mica" },
  { ch: 69, en: "Ceramic products", vn: "Sản phẩm gốm, sứ" },
  { ch: 70, en: "Glass and glassware", vn: "Thủy tinh và các sản phẩm bằng thủy tinh" },
  { ch: 71, en: "Pearls, precious stones/metals; jewellery; coin", vn: "Ngọc trai, đá/kim loại quý; đồ trang sức; tiền kim loại" },
  { ch: 72, en: "Iron and steel", vn: "Sắt và thép" },
  { ch: 73, en: "Articles of iron or steel", vn: "Các sản phẩm bằng sắt hoặc thép" },
  { ch: 74, en: "Copper and articles thereof", vn: "Đồng và các sản phẩm bằng đồng" },
  { ch: 75, en: "Nickel and articles thereof", vn: "Niken và các sản phẩm bằng niken" },
  { ch: 76, en: "Aluminium and articles thereof", vn: "Nhôm và các sản phẩm bằng nhôm" },
  { ch: 77, en: "(Reserved for possible future use)", vn: "(Dự phòng cho sử dụng trong tương lai)" },
  { ch: 78, en: "Lead and articles thereof", vn: "Chì và các sản phẩm bằng chì" },
  { ch: 79, en: "Zinc and articles thereof", vn: "Kẽm và các sản phẩm bằng kẽm" },
  { ch: 80, en: "Tin and articles thereof", vn: "Thiếc và các sản phẩm bằng thiếc" },
  { ch: 81, en: "Other base metals; cermets; articles thereof", vn: "Kim loại cơ bản khác; gốm kim loại; sản phẩm" },
  { ch: 82, en: "Tools, implements, cutlery of base metal; parts thereof", vn: "Dụng cụ, đồ nghề, dao kéo bằng kim loại cơ bản; bộ phận" },
  { ch: 83, en: "Miscellaneous articles of base metal", vn: "Các sản phẩm khác bằng kim loại cơ bản" },
  { ch: 84, en: "Machinery, mechanical appliances and boilers; parts thereof", vn: "Máy móc, thiết bị cơ khí và nồi hơi; bộ phận" },
  { ch: 85, en: "Electrical machinery and equipment; parts thereof", vn: "Máy và thiết bị điện; bộ phận" },
  { ch: 86, en: "Railway locomotives, rolling-stock; track fixtures; signalling", vn: "Đầu máy, toa xe đường sắt; phụ kiện đường ray; tín hiệu" },
  { ch: 87, en: "Vehicles other than railway rolling-stock; parts thereof", vn: "Xe cộ trừ toa xe đường sắt; bộ phận và phụ kiện" },
  { ch: 88, en: "Aircraft, spacecraft, and parts thereof", vn: "Máy bay, tàu vũ trụ và bộ phận" },
  { ch: 89, en: "Ships, boats and floating structures", vn: "Tàu thủy, thuyền và kết cấu nổi" },
  { ch: 90, en: "Optical, measuring, medical and precision instruments; parts", vn: "Dụng cụ quang học, đo lường, y tế và độ chính xác; bộ phận" },
  { ch: 91, en: "Clocks and watches and parts thereof", vn: "Đồng hồ các loại và bộ phận" },
  { ch: 92, en: "Musical instruments; parts and accessories", vn: "Nhạc cụ; bộ phận và phụ kiện" },
  { ch: 93, en: "Arms and ammunition; parts and accessories thereof", vn: "Vũ khí và đạn dược; bộ phận và phụ kiện" },
  { ch: 94, en: "Furniture; bedding; luminaires, nes; prefabricated buildings", vn: "Đồ nội thất; đệm; đèn chiếu sáng; nhà lắp ghép" },
  { ch: 95, en: "Toys, games and sports requisites; parts thereof", vn: "Đồ chơi, dụng cụ trò chơi và thể thao; bộ phận" },
  { ch: 96, en: "Miscellaneous manufactured articles", vn: "Các mặt hàng chế tạo khác" },
  { ch: 97, en: "Works of art, collectors' pieces and antiques", vn: "Tác phẩm nghệ thuật, đồ sưu tầm và đồ cổ" },
];

const CHAPTER_TO_SECTION = new Map<number, HsSection>();
for (const s of HS_SECTIONS) for (let c = s.from; c <= s.to; c++) CHAPTER_TO_SECTION.set(c, s);
const CHAPTER_BY_NO = new Map(HS_CHAPTERS.map((c) => [c.ch, c]));

/** Digits only, e.g. "8415.83.10" → "84158310". */
export function hsDigits(code: string): string {
  return (code || "").replace(/\D/g, "");
}

/** Chapter number (1–97) from any HS code, or null if it can't be derived. */
export function chapterOf(code: string): number | null {
  const d = hsDigits(code);
  if (d.length < 2) return null;
  const ch = Number(d.slice(0, 2));
  return ch >= 1 && ch <= 97 ? ch : null;
}

/** 4-digit heading from any HS code, e.g. "8415.83" → "8415". */
export function headingOf(code: string): string | null {
  const d = hsDigits(code);
  return d.length >= 4 ? d.slice(0, 4) : null;
}

export function sectionOfChapter(ch: number | null): HsSection | null {
  return ch == null ? null : CHAPTER_TO_SECTION.get(ch) ?? null;
}

export function chapterInfo(ch: number | null): HsChapter | null {
  return ch == null ? null : CHAPTER_BY_NO.get(ch) ?? null;
}
