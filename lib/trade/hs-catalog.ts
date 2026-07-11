/**
 * Curated HS 2022 reference catalogue for Humiley procurement.
 *
 * These are six-digit subheadings of the Harmonized System covering the goods Humiley
 * actually buys and imports (HVAC, air movement, filtration, sheet-metal, electrical,
 * instruments, materials, tools, PPE, packaging, chemicals). They are a WORKING REFERENCE
 * to help the team find and verify the right classification — duty/VAT are NOT asserted
 * here (dutyVerified = false); confirm the live rate against the current Vietnam import
 * tariff, or use the "Traded by Humiley" codes that carry researched MFN/route data.
 *
 * The exhaustive 8/10-digit official list is loaded via Admin → Import (CSV) from the
 * General Department of Vietnam Customs nomenclature. Codes here that overlap an imported
 * row are updated in place, never duplicated (upsert by code).
 */

export type HsCatalogEntry = {
  code: string;
  en: string;
  vn: string;
  category: string;
  keywords?: string;
};

export const HS_CATALOG: HsCatalogEntry[] = [
  // ── HVAC & Refrigeration ────────────────────────────────────────────────
  { code: "8415.10", en: "Air conditioners, window/wall or split-system, self-contained", vn: "Máy điều hòa không khí loại lắp cửa sổ/tường hoặc kiểu tách rời", category: "HVAC & Refrigeration", keywords: "aircon, split, window, packaged AC" },
  { code: "8415.81", en: "Air conditioners with refrigerating unit + reverse cycle (heat pump)", vn: "Máy điều hòa có bộ làm lạnh và van đảo chiều (bơm nhiệt)", category: "HVAC & Refrigeration", keywords: "reversible, heat pump, VRF" },
  { code: "8415.82", en: "Air conditioners incorporating a refrigerating unit, other", vn: "Máy điều hòa có bộ làm lạnh, loại khác", category: "HVAC & Refrigeration", keywords: "packaged, rooftop, chiller AHU" },
  { code: "8415.90", en: "Parts of air conditioning machines", vn: "Bộ phận của máy điều hòa không khí", category: "HVAC & Refrigeration", keywords: "coil, spare parts" },
  { code: "8418.61", en: "Heat pumps other than air conditioning machines of 8415", vn: "Bơm nhiệt trừ máy điều hòa thuộc nhóm 8415", category: "HVAC & Refrigeration", keywords: "heat pump" },
  { code: "8418.69", en: "Refrigerating or freezing equipment, other (water chillers)", vn: "Thiết bị làm lạnh hoặc đông lạnh, loại khác (máy làm lạnh nước)", category: "HVAC & Refrigeration", keywords: "chiller, condensing unit" },
  { code: "8419.50", en: "Heat exchange units", vn: "Bộ trao đổi nhiệt", category: "HVAC & Refrigeration", keywords: "heat exchanger, plate, shell tube" },
  { code: "8419.89", en: "Machinery for treatment by temperature change, other (cooling towers)", vn: "Máy xử lý bằng thay đổi nhiệt độ, loại khác (tháp giải nhiệt)", category: "HVAC & Refrigeration", keywords: "cooling tower, process heater" },
  { code: "8419.90", en: "Parts of machinery of heading 8419", vn: "Bộ phận của máy thuộc nhóm 8419", category: "HVAC & Refrigeration", keywords: "heat exchanger parts" },

  // ── Air movement: fans, compressors, pumps ─────────────────────────────
  { code: "8414.51", en: "Table/floor/wall/ceiling/roof fans with self-contained motor ≤125 W", vn: "Quạt bàn/sàn/tường/trần/mái có động cơ điện ≤125 W", category: "Air Movement", keywords: "fan, exhaust, ceiling fan" },
  { code: "8414.60", en: "Ventilation hoods, max horizontal side ≤120 cm", vn: "Chụp hút có cạnh ngang lớn nhất ≤120 cm", category: "Air Movement", keywords: "kitchen hood, extractor hood" },
  { code: "8414.80", en: "Air/gas pumps, compressors and ventilating hoods, other", vn: "Bơm không khí/khí, máy nén và chụp hút thông gió, loại khác", category: "Air Movement", keywords: "plug fan, blower, industrial fan, compressor" },
  { code: "8414.90", en: "Parts of pumps, compressors, fans and hoods", vn: "Bộ phận của bơm, máy nén, quạt và chụp hút", category: "Air Movement", keywords: "impeller, fan parts" },
  { code: "8414.10", en: "Vacuum pumps", vn: "Bơm chân không", category: "Air Movement", keywords: "vacuum" },
  { code: "8414.40", en: "Air compressors mounted on a wheeled chassis for towing", vn: "Máy nén khí gắn trên khung có bánh xe để kéo", category: "Air Movement", keywords: "portable compressor" },
  { code: "8413.70", en: "Centrifugal pumps, other", vn: "Bơm ly tâm, loại khác", category: "Air Movement", keywords: "centrifugal pump, water pump" },
  { code: "8413.81", en: "Pumps for liquids, other", vn: "Bơm chất lỏng, loại khác", category: "Air Movement", keywords: "dosing pump, booster pump" },
  { code: "8413.91", en: "Parts of pumps for liquids", vn: "Bộ phận của bơm chất lỏng", category: "Air Movement", keywords: "pump parts, seal, impeller" },

  // ── Air filtration & media ─────────────────────────────────────────────
  { code: "8421.31", en: "Intake air filters for internal combustion engines", vn: "Bộ lọc khí nạp cho động cơ đốt trong", category: "Air Filtration", keywords: "engine air filter" },
  { code: "8421.32", en: "Catalytic converters/particulate filters for engine exhaust", vn: "Bộ chuyển đổi xúc tác/lọc hạt cho khí thải động cơ", category: "Air Filtration", keywords: "particulate filter" },
  { code: "8421.99", en: "Parts of filtering or purifying machinery", vn: "Bộ phận của máy lọc hoặc làm sạch", category: "Air Filtration", keywords: "filter housing parts, HEPA frame" },
  { code: "8421.21", en: "Filtering or purifying machinery for water", vn: "Máy lọc hoặc làm sạch nước", category: "Air Filtration", keywords: "water filter, RO" },
  { code: "8421.29", en: "Filtering or purifying machinery for liquids, other", vn: "Máy lọc hoặc làm sạch chất lỏng, loại khác", category: "Air Filtration", keywords: "liquid filter" },
  { code: "5911.90", en: "Textile products for technical uses, other (filter media)", vn: "Sản phẩm dệt dùng cho kỹ thuật, loại khác (vật liệu lọc)", category: "Air Filtration", keywords: "filter media, filter cloth, bag filter" },
  { code: "7019.80", en: "Glass wool and articles of glass wool", vn: "Bông thủy tinh và sản phẩm bằng bông thủy tinh", category: "Air Filtration", keywords: "glass wool, filter media, insulation" },

  // ── Ducting, sheet-metal & steel articles ──────────────────────────────
  { code: "7308.90", en: "Structures and parts of structures, of iron or steel, other", vn: "Kết cấu và bộ phận kết cấu, bằng sắt hoặc thép, loại khác", category: "Steel Fabrication", keywords: "duct support, platform, frame, structure" },
  { code: "7308.30", en: "Doors, windows and their frames, of iron or steel", vn: "Cửa ra vào, cửa sổ và khung, bằng sắt hoặc thép", category: "Steel Fabrication", keywords: "steel door, access door" },
  { code: "7308.40", en: "Equipment for scaffolding, shuttering, propping or pit-propping", vn: "Thiết bị giàn giáo, cốp pha, chống đỡ", category: "Steel Fabrication", keywords: "scaffolding" },
  { code: "7326.90", en: "Other articles of iron or steel, other", vn: "Sản phẩm khác bằng sắt hoặc thép, loại khác", category: "Steel Fabrication", keywords: "bracket, fabricated part, duct accessory" },
  { code: "7326.20", en: "Articles of iron or steel wire", vn: "Sản phẩm bằng dây sắt hoặc thép", category: "Steel Fabrication", keywords: "wire tray, mesh tray" },
  { code: "7306.30", en: "Welded tubes/pipes of iron/non-alloy steel, circular", vn: "Ống hàn bằng sắt/thép không hợp kim, tiết diện tròn", category: "Steel Fabrication", keywords: "steel pipe, tube" },
  { code: "7306.40", en: "Welded tubes/pipes of stainless steel", vn: "Ống hàn bằng thép không gỉ", category: "Steel Fabrication", keywords: "stainless pipe, SS tube" },
  { code: "7307.19", en: "Tube or pipe fittings, cast, other", vn: "Phụ kiện ghép nối ống, đúc, loại khác", category: "Steel Fabrication", keywords: "elbow, tee, fitting" },
  { code: "7307.29", en: "Tube or pipe fittings of stainless steel, other", vn: "Phụ kiện ghép nối ống bằng thép không gỉ, loại khác", category: "Steel Fabrication", keywords: "SS fitting, flange" },
  { code: "7307.99", en: "Tube or pipe fittings of iron/steel, other", vn: "Phụ kiện ghép nối ống bằng sắt/thép, loại khác", category: "Steel Fabrication", keywords: "fitting, coupling" },
  { code: "7309.00", en: "Reservoirs, tanks, vats of iron/steel, capacity > 300 L", vn: "Bể chứa, thùng, bồn bằng sắt/thép, dung tích > 300 L", category: "Steel Fabrication", keywords: "tank, reservoir" },
  { code: "7314.20", en: "Grill/netting/fencing welded at intersection, of steel wire", vn: "Lưới, hàng rào hàn tại điểm giao, bằng dây thép", category: "Steel Fabrication", keywords: "welded mesh, grating" },

  // ── Fasteners & fixings ────────────────────────────────────────────────
  { code: "7318.15", en: "Screws and bolts, threaded, other (with or without nuts/washers)", vn: "Vít và bu lông có ren, loại khác", category: "Fasteners", keywords: "bolt, screw, hex bolt, anchor" },
  { code: "7318.16", en: "Nuts, of iron or steel", vn: "Đai ốc, bằng sắt hoặc thép", category: "Fasteners", keywords: "nut" },
  { code: "7318.19", en: "Threaded articles of iron/steel, other", vn: "Sản phẩm có ren bằng sắt/thép, loại khác", category: "Fasteners", keywords: "threaded rod, stud" },
  { code: "7318.21", en: "Spring washers and other lock washers", vn: "Vòng đệm lò xo và vòng đệm khóa khác", category: "Fasteners", keywords: "lock washer, spring washer" },
  { code: "7318.22", en: "Washers, other", vn: "Vòng đệm, loại khác", category: "Fasteners", keywords: "flat washer" },
  { code: "7317.00", en: "Nails, tacks, staples and similar articles, of iron/steel", vn: "Đinh, đinh mũ, ghim dập và sản phẩm tương tự, bằng sắt/thép", category: "Fasteners", keywords: "nail, staple" },
  { code: "8311.10", en: "Coated electrodes of base metal, for electric arc-welding", vn: "Que hàn có vỏ bọc bằng kim loại cơ bản, dùng hàn hồ quang điện", category: "Fasteners", keywords: "welding electrode, welding rod" },

  // ── Iron, steel & aluminium stock ──────────────────────────────────────
  { code: "7209.16", en: "Flat-rolled steel, cold-rolled, thickness 1 mm to 3 mm", vn: "Thép cán phẳng, cán nguội, chiều dày 1 mm đến 3 mm", category: "Metal Stock", keywords: "CRC, cold rolled coil, sheet" },
  { code: "7210.49", en: "Flat-rolled steel, zinc-coated (galvanized), other", vn: "Thép cán phẳng, mạ kẽm, loại khác", category: "Metal Stock", keywords: "galvanized, GI sheet, hot-dip" },
  { code: "7210.70", en: "Flat-rolled steel, painted, varnished or plastic-coated", vn: "Thép cán phẳng, sơn, phủ vécni hoặc phủ plastic", category: "Metal Stock", keywords: "pre-painted, colour coated, PPGI" },
  { code: "7219.34", en: "Flat-rolled stainless steel, cold-rolled, 0.5 mm to 1 mm", vn: "Thép không gỉ cán phẳng, cán nguội, 0,5 mm đến 1 mm", category: "Metal Stock", keywords: "stainless sheet, SS304, SS316" },
  { code: "7216.40", en: "Angles, shapes and sections of steel, L or T, ≥ 80 mm", vn: "Góc, khuôn và hình bằng thép, chữ L hoặc T, ≥ 80 mm", category: "Metal Stock", keywords: "angle, L section, T section, profile" },
  { code: "7604.21", en: "Hollow profiles of aluminium alloys", vn: "Hình dạng rỗng bằng hợp kim nhôm", category: "Metal Stock", keywords: "aluminium extrusion, hollow profile" },
  { code: "7604.29", en: "Bars, rods and profiles of aluminium alloys, other", vn: "Thanh, que và hình bằng hợp kim nhôm, loại khác", category: "Metal Stock", keywords: "aluminium profile, extrusion" },
  { code: "7606.12", en: "Aluminium alloy plates/sheets/strip, rectangular, > 0.2 mm", vn: "Tấm/lá/dải hợp kim nhôm, hình chữ nhật, > 0,2 mm", category: "Metal Stock", keywords: "aluminium sheet, plate" },
  { code: "7608.20", en: "Tubes and pipes of aluminium alloys", vn: "Ống và ống dẫn bằng hợp kim nhôm", category: "Metal Stock", keywords: "aluminium tube" },
  { code: "7610.90", en: "Aluminium structures and parts of structures, other", vn: "Kết cấu nhôm và bộ phận kết cấu, loại khác", category: "Metal Stock", keywords: "aluminium frame, structure" },
  { code: "7411.10", en: "Tubes and pipes of refined copper", vn: "Ống và ống dẫn bằng đồng tinh luyện", category: "Metal Stock", keywords: "copper pipe, refrigeration pipe" },
  { code: "7413.00", en: "Stranded wire, cables and plaited bands of copper", vn: "Dây bện, cáp và dải tết bằng đồng", category: "Metal Stock", keywords: "copper cable, earthing" },

  // ── Plastics & piping ──────────────────────────────────────────────────
  { code: "3917.23", en: "Rigid tubes/pipes of polymers of vinyl chloride (PVC)", vn: "Ống cứng bằng polyme vinyl clorua (PVC)", category: "Plastics & Piping", keywords: "PVC pipe, uPVC, conduit" },
  { code: "3917.21", en: "Rigid tubes/pipes of polymers of ethylene (PE)", vn: "Ống cứng bằng polyme etylen (PE)", category: "Plastics & Piping", keywords: "HDPE pipe, PE pipe" },
  { code: "3917.32", en: "Tubes/pipes of plastics, not reinforced, without fittings", vn: "Ống bằng plastic, không gia cố, không có phụ kiện", category: "Plastics & Piping", keywords: "flexible tube, plastic hose" },
  { code: "3917.40", en: "Fittings for tubes and pipes, of plastics", vn: "Phụ kiện cho ống, bằng plastic", category: "Plastics & Piping", keywords: "PVC fitting, elbow, tee" },
  { code: "3920.10", en: "Plates/sheets/film of polymers of ethylene, non-cellular", vn: "Tấm/lá/màng bằng polyme etylen, không xốp", category: "Plastics & Piping", keywords: "PE sheet, film, liner" },
  { code: "3921.13", en: "Cellular plates/sheets of polyurethanes", vn: "Tấm/lá xốp bằng polyurethan", category: "Plastics & Piping", keywords: "PU foam, PIR panel core, insulation foam" },
  { code: "3925.90", en: "Builders' ware of plastics, other", vn: "Đồ dùng xây dựng bằng plastic, loại khác", category: "Plastics & Piping", keywords: "plastic building accessory, access panel" },
  { code: "3926.90", en: "Other articles of plastics, other", vn: "Sản phẩm khác bằng plastic, loại khác", category: "Plastics & Piping", keywords: "cable tie, clip, spacer, grommet" },
  { code: "3919.90", en: "Self-adhesive plates/sheets/film of plastics, other", vn: "Tấm/lá/màng plastic tự dính, loại khác", category: "Plastics & Piping", keywords: "adhesive film, protective film" },
  { code: "3923.90", en: "Articles for conveyance or packing of goods, of plastics, other", vn: "Sản phẩm để vận chuyển hoặc đóng gói, bằng plastic, loại khác", category: "Plastics & Piping", keywords: "plastic packaging, container" },

  // ── Rubber, seals & belts ──────────────────────────────────────────────
  { code: "4016.93", en: "Gaskets, washers and other seals of vulcanized rubber", vn: "Vòng đệm, gioăng và phớt bằng cao su lưu hóa", category: "Rubber & Seals", keywords: "gasket, o-ring, seal, gland" },
  { code: "4016.99", en: "Other articles of vulcanized rubber (non-cellular), other", vn: "Sản phẩm khác bằng cao su lưu hóa (không xốp), loại khác", category: "Rubber & Seals", keywords: "rubber mount, anti-vibration, bushing" },
  { code: "4009.31", en: "Rubber tubes/hoses reinforced with textiles, without fittings", vn: "Ống cao su gia cố bằng vật liệu dệt, không có phụ kiện", category: "Rubber & Seals", keywords: "hose, flexible connector" },
  { code: "4010.12", en: "Conveyor belts of vulcanized rubber, reinforced with textiles", vn: "Băng tải bằng cao su lưu hóa, gia cố bằng vật liệu dệt", category: "Rubber & Seals", keywords: "conveyor belt" },
  { code: "4010.35", en: "Endless synchronous (timing) belts, defined circumference", vn: "Dây đai đồng bộ vô tận (dây đai răng), chu vi xác định", category: "Rubber & Seals", keywords: "timing belt, v-belt, drive belt" },

  // ── Insulation & mineral products ──────────────────────────────────────
  { code: "6806.10", en: "Slag/rock wool and similar mineral wools, in bulk/sheets/rolls", vn: "Bông xỉ, bông đá và bông khoáng tương tự, dạng rời/tấm/cuộn", category: "Insulation", keywords: "rock wool, mineral wool, rockwool" },
  { code: "6806.90", en: "Heat/sound-insulating mineral mixtures and articles, other", vn: "Hỗn hợp và sản phẩm khoáng cách nhiệt/âm, loại khác", category: "Insulation", keywords: "insulation board, acoustic" },
  { code: "3921.11", en: "Cellular plates/sheets of polymers of styrene", vn: "Tấm/lá xốp bằng polyme styren", category: "Insulation", keywords: "EPS, XPS, foam board" },

  // ── Electrical: power, distribution & protection ───────────────────────
  { code: "8501.51", en: "AC motors, multi-phase, output ≤ 750 W", vn: "Động cơ điện xoay chiều, nhiều pha, công suất ≤ 750 W", category: "Electrical", keywords: "motor, AC motor" },
  { code: "8501.52", en: "AC motors, multi-phase, output 750 W to 75 kW", vn: "Động cơ điện xoay chiều, nhiều pha, 750 W đến 75 kW", category: "Electrical", keywords: "motor, 3-phase motor, fan motor" },
  { code: "8501.53", en: "AC motors, multi-phase, output > 75 kW", vn: "Động cơ điện xoay chiều, nhiều pha, > 75 kW", category: "Electrical", keywords: "large motor" },
  { code: "8504.31", en: "Electrical transformers, power handling ≤ 1 kVA", vn: "Máy biến áp điện, công suất ≤ 1 kVA", category: "Electrical", keywords: "transformer, control transformer" },
  { code: "8504.40", en: "Static converters (VFD, inverters, rectifiers, UPS)", vn: "Bộ biến đổi tĩnh (biến tần, bộ chỉnh lưu, UPS)", category: "Electrical", keywords: "VFD, inverter, drive, rectifier, UPS" },
  { code: "8536.10", en: "Fuses, for a voltage ≤ 1,000 V", vn: "Cầu chì, điện áp ≤ 1.000 V", category: "Electrical", keywords: "fuse" },
  { code: "8536.30", en: "Other apparatus for protecting electrical circuits", vn: "Thiết bị khác để bảo vệ mạch điện", category: "Electrical", keywords: "surge protector, SPD, protection relay" },
  { code: "8536.41", en: "Relays for a voltage ≤ 60 V", vn: "Rơ le cho điện áp ≤ 60 V", category: "Electrical", keywords: "relay" },
  { code: "8536.50", en: "Switches, other, for a voltage ≤ 1,000 V", vn: "Công tắc, loại khác, điện áp ≤ 1.000 V", category: "Electrical", keywords: "switch, selector, push button" },
  { code: "8536.69", en: "Plugs and sockets, for a voltage ≤ 1,000 V", vn: "Phích cắm và ổ cắm, điện áp ≤ 1.000 V", category: "Electrical", keywords: "socket, plug, connector" },
  { code: "8536.90", en: "Other apparatus (connectors, terminals) ≤ 1,000 V", vn: "Thiết bị khác (đầu nối, cực đấu dây) ≤ 1.000 V", category: "Electrical", keywords: "terminal block, connector, junction" },
  { code: "8537.10", en: "Boards/panels for electric control ≤ 1,000 V", vn: "Bảng/tủ điều khiển điện ≤ 1.000 V", category: "Electrical", keywords: "control panel, distribution board, MCC" },
  { code: "8538.10", en: "Boards/panels/consoles for goods of 8537 (empty enclosures)", vn: "Bảng/tủ/bàn điều khiển cho hàng thuộc 8537 (vỏ tủ rỗng)", category: "Electrical", keywords: "enclosure, empty panel" },
  { code: "8538.90", en: "Parts for apparatus of headings 8535/8536/8537", vn: "Bộ phận cho thiết bị thuộc nhóm 8535/8536/8537", category: "Electrical", keywords: "din rail, panel parts" },
  { code: "8539.52", en: "Light-emitting diode (LED) lamps", vn: "Bóng đèn điốt phát quang (LED)", category: "Electrical", keywords: "LED lamp, bulb, tube" },
  { code: "8507.20", en: "Lead-acid accumulators, other", vn: "Ắc quy axit-chì, loại khác", category: "Electrical", keywords: "battery, lead acid, UPS battery" },
  { code: "8507.60", en: "Lithium-ion accumulators", vn: "Ắc quy liti-ion", category: "Electrical", keywords: "lithium battery, li-ion" },
  { code: "8541.43", en: "Photovoltaic cells assembled in modules or panels", vn: "Tế bào quang điện lắp ráp thành mô-đun hoặc tấm", category: "Electrical", keywords: "solar panel, PV module" },

  // ── Cable & wiring ─────────────────────────────────────────────────────
  { code: "8544.42", en: "Electric conductors ≤ 1,000 V, fitted with connectors", vn: "Dây dẫn điện ≤ 1.000 V, có đầu nối", category: "Cable & Wiring", keywords: "patch cable, harness, cordset" },
  { code: "8544.49", en: "Electric conductors ≤ 1,000 V, not fitted with connectors", vn: "Dây dẫn điện ≤ 1.000 V, không có đầu nối", category: "Cable & Wiring", keywords: "cable, power cable, wire" },
  { code: "8544.60", en: "Electric conductors, for a voltage > 1,000 V", vn: "Dây dẫn điện, điện áp > 1.000 V", category: "Cable & Wiring", keywords: "MV cable, high voltage cable" },
  { code: "8544.20", en: "Co-axial cable and other co-axial electric conductors", vn: "Cáp đồng trục và dây dẫn điện đồng trục khác", category: "Cable & Wiring", keywords: "coaxial, signal cable" },
  { code: "8547.20", en: "Insulating fittings of plastics", vn: "Phụ kiện cách điện bằng plastic", category: "Cable & Wiring", keywords: "cable gland, insulator, bushing" },
  { code: "8307.10", en: "Flexible tubing of iron or steel", vn: "Ống mềm bằng sắt hoặc thép", category: "Cable & Wiring", keywords: "flexible conduit, cable protection" },

  // ── Valves & actuators ─────────────────────────────────────────────────
  { code: "8481.10", en: "Pressure-reducing valves", vn: "Van giảm áp", category: "Valves & Actuators", keywords: "pressure reducing valve, PRV" },
  { code: "8481.20", en: "Valves for oleohydraulic or pneumatic transmissions", vn: "Van cho truyền động thủy lực hoặc khí nén", category: "Valves & Actuators", keywords: "solenoid valve, pneumatic valve" },
  { code: "8481.30", en: "Check (non-return) valves", vn: "Van một chiều (van chặn)", category: "Valves & Actuators", keywords: "check valve, non-return" },
  { code: "8481.40", en: "Safety or relief valves", vn: "Van an toàn hoặc van xả", category: "Valves & Actuators", keywords: "safety valve, relief valve" },
  { code: "8481.90", en: "Parts of taps, cocks, valves and similar appliances", vn: "Bộ phận của vòi, van và thiết bị tương tự", category: "Valves & Actuators", keywords: "valve parts, actuator" },

  // ── Mechanical: bearings, gears, couplings ─────────────────────────────
  { code: "8482.10", en: "Ball bearings", vn: "Ổ bi", category: "Mechanical", keywords: "bearing, ball bearing" },
  { code: "8483.30", en: "Bearing housings and plain shaft bearings", vn: "Gối đỡ ổ trục và ổ trượt", category: "Mechanical", keywords: "pillow block, bearing housing" },
  { code: "8483.40", en: "Gears/gearing, ball or roller screws, gear boxes", vn: "Bánh răng/bộ truyền, vít bi hoặc vít con lăn, hộp số", category: "Mechanical", keywords: "gearbox, reducer, gear" },
  { code: "8483.60", en: "Clutches and shaft couplings", vn: "Ly hợp và khớp nối trục", category: "Mechanical", keywords: "coupling, clutch" },

  // ── Instruments & controls ─────────────────────────────────────────────
  { code: "9025.80", en: "Hydrometers, hygrometers, barometers and similar instruments", vn: "Tỷ trọng kế, ẩm kế, khí áp kế và dụng cụ tương tự", category: "Instruments", keywords: "hygrometer, humidity, barometer" },
  { code: "9025.19", en: "Thermometers, not combined with other instruments, other", vn: "Nhiệt kế, không kết hợp với dụng cụ khác, loại khác", category: "Instruments", keywords: "thermometer, temperature" },
  { code: "9026.10", en: "Instruments for measuring/checking flow or level of liquids", vn: "Dụng cụ đo/kiểm tra lưu lượng hoặc mức chất lỏng", category: "Instruments", keywords: "flow meter, level sensor" },
  { code: "9026.20", en: "Instruments for measuring/checking pressure", vn: "Dụng cụ đo/kiểm tra áp suất", category: "Instruments", keywords: "pressure gauge, pressure transmitter, DP" },
  { code: "9026.80", en: "Instruments for measuring variables of liquids/gases, other", vn: "Dụng cụ đo các đại lượng của chất lỏng/khí, loại khác", category: "Instruments", keywords: "air velocity, sensor" },
  { code: "9027.10", en: "Gas or smoke analysis apparatus", vn: "Thiết bị phân tích khí hoặc khói", category: "Instruments", keywords: "gas analyser, CO2 sensor, particle counter" },
  { code: "9028.20", en: "Liquid supply or production meters", vn: "Đồng hồ đo cung cấp hoặc sản xuất chất lỏng", category: "Instruments", keywords: "water meter" },
  { code: "9028.30", en: "Electricity supply or production meters", vn: "Đồng hồ đo điện", category: "Instruments", keywords: "energy meter, kWh meter" },
  { code: "9030.31", en: "Multimeters without a recording device", vn: "Đồng hồ vạn năng không có bộ ghi", category: "Instruments", keywords: "multimeter, tester" },
  { code: "9032.10", en: "Thermostats", vn: "Bộ điều nhiệt (thermostat)", category: "Instruments", keywords: "thermostat, temperature controller" },
  { code: "9032.20", en: "Manostats (pressure controllers)", vn: "Bộ điều áp (manostat)", category: "Instruments", keywords: "pressure switch, manostat" },
  { code: "9032.81", en: "Hydraulic or pneumatic automatic regulating instruments", vn: "Dụng cụ tự động điều chỉnh thủy lực hoặc khí nén", category: "Instruments", keywords: "actuator controller, damper actuator" },
  { code: "9032.90", en: "Parts of automatic regulating or controlling instruments", vn: "Bộ phận của dụng cụ tự động điều chỉnh hoặc kiểm soát", category: "Instruments", keywords: "controller parts, BMS" },

  // ── Tools ──────────────────────────────────────────────────────────────
  { code: "8467.21", en: "Electric drills, hand-held, with self-contained motor", vn: "Máy khoan cầm tay chạy điện, có động cơ liền", category: "Tools", keywords: "drill, power tool" },
  { code: "8467.29", en: "Electromechanical hand tools with self-contained motor, other", vn: "Dụng cụ cầm tay cơ điện có động cơ liền, loại khác", category: "Tools", keywords: "grinder, power tool, cutter" },
  { code: "8205.40", en: "Screwdrivers (hand tools)", vn: "Tua vít (dụng cụ cầm tay)", category: "Tools", keywords: "screwdriver" },
  { code: "8205.59", en: "Hand tools, other", vn: "Dụng cụ cầm tay, loại khác", category: "Tools", keywords: "hand tool, riveter" },
  { code: "8204.11", en: "Hand-operated spanners and wrenches, non-adjustable", vn: "Cờ lê và mỏ lết vặn bằng tay, không điều chỉnh", category: "Tools", keywords: "spanner, wrench" },
  { code: "8203.20", en: "Pliers, pincers, tweezers and similar tools", vn: "Kìm, kẹp, nhíp và dụng cụ tương tự", category: "Tools", keywords: "pliers, cutter" },
  { code: "8207.50", en: "Interchangeable tools for drilling (not rock drilling)", vn: "Dụng cụ thay lắp để khoan (trừ khoan đá)", category: "Tools", keywords: "drill bit" },
  { code: "8202.31", en: "Circular saw blades with working part of steel", vn: "Lưỡi cưa đĩa có phần cắt bằng thép", category: "Tools", keywords: "saw blade, cutting disc" },

  // ── Building hardware ──────────────────────────────────────────────────
  { code: "8302.41", en: "Base-metal mountings/fittings suitable for buildings", vn: "Giá đỡ/phụ kiện bằng kim loại cơ bản dùng cho tòa nhà", category: "Hardware", keywords: "hinge, handle, bracket, building fitting" },
  { code: "8302.42", en: "Base-metal mountings/fittings suitable for furniture", vn: "Giá đỡ/phụ kiện bằng kim loại cơ bản dùng cho đồ nội thất", category: "Hardware", keywords: "furniture fitting, slide" },
  { code: "8301.40", en: "Locks of base metal, other", vn: "Khóa bằng kim loại cơ bản, loại khác", category: "Hardware", keywords: "lock, padlock" },

  // ── PPE & safety ───────────────────────────────────────────────────────
  { code: "6506.10", en: "Safety headgear (hard hats / helmets)", vn: "Mũ bảo hộ (mũ cứng)", category: "PPE & Safety", keywords: "hard hat, safety helmet" },
  { code: "9004.90", en: "Spectacles, goggles and the like, protective, other", vn: "Kính mắt, kính bảo hộ và loại tương tự, bảo hộ, loại khác", category: "PPE & Safety", keywords: "safety goggles, glasses" },
  { code: "6116.10", en: "Gloves, knitted, impregnated/coated with plastics or rubber", vn: "Găng tay dệt kim, ngâm tẩm/phủ plastic hoặc cao su", category: "PPE & Safety", keywords: "work gloves, coated gloves" },
  { code: "4015.19", en: "Gloves of vulcanized rubber, other", vn: "Găng tay bằng cao su lưu hóa, loại khác", category: "PPE & Safety", keywords: "rubber gloves, nitrile" },
  { code: "6307.90", en: "Made-up textile articles, other (incl. dust/face masks)", vn: "Sản phẩm dệt đã hoàn thiện, loại khác (gồm khẩu trang)", category: "PPE & Safety", keywords: "face mask, dust mask, respirator textile" },
  { code: "6403.40", en: "Footwear with protective metal toe-cap, leather uppers", vn: "Giày có mũi bảo vệ bằng kim loại, mũ giày bằng da", category: "PPE & Safety", keywords: "safety shoes, steel toe boots" },
  { code: "9020.00", en: "Other breathing appliances and gas masks", vn: "Thiết bị thở khác và mặt nạ phòng độc", category: "PPE & Safety", keywords: "respirator, gas mask" },

  // ── Lighting ───────────────────────────────────────────────────────────
  { code: "9405.11", en: "Ceiling/wall electric luminaires designed for LED light sources", vn: "Đèn trần/tường dùng nguồn sáng LED", category: "Lighting", keywords: "LED panel light, ceiling light, downlight" },
  { code: "9405.42", en: "Other electric luminaires and fittings, LED light sources", vn: "Đèn và bộ đèn điện khác, nguồn sáng LED", category: "Lighting", keywords: "LED fitting, floodlight, highbay" },
  { code: "9405.61", en: "Illuminated signs, name-plates and the like, LED", vn: "Biển hiệu, biển tên chiếu sáng và loại tương tự, LED", category: "Lighting", keywords: "exit sign, illuminated sign" },

  // ── Packaging & consumables ────────────────────────────────────────────
  { code: "4819.10", en: "Cartons, boxes and cases of corrugated paper/paperboard", vn: "Thùng, hộp và hộp đựng bằng giấy/bìa sóng", category: "Packaging", keywords: "carton, corrugated box" },
  { code: "3923.21", en: "Sacks and bags of polymers of ethylene", vn: "Bao và túi bằng polyme etylen", category: "Packaging", keywords: "poly bag, PE bag" },
  { code: "3919.10", en: "Self-adhesive tape of plastics, in rolls ≤ 20 cm wide", vn: "Băng dính bằng plastic, dạng cuộn rộng ≤ 20 cm", category: "Packaging", keywords: "tape, adhesive tape, duct tape" },
  { code: "7607.11", en: "Aluminium foil, not backed, rolled but not further worked", vn: "Lá nhôm, không có lớp bồi, đã cán nhưng chưa gia công thêm", category: "Packaging", keywords: "aluminium foil, duct foil tape base" },

  // ── Chemicals, adhesives, paints & lubricants ──────────────────────────
  { code: "3208.90", en: "Paints/varnishes in a non-aqueous medium, synthetic polymers, other", vn: "Sơn/vécni trong môi trường không chứa nước, polyme tổng hợp, loại khác", category: "Chemicals & Paint", keywords: "solvent paint, epoxy, coating" },
  { code: "3209.10", en: "Paints based on acrylic/vinyl polymers in an aqueous medium", vn: "Sơn gốc polyme acrylic/vinyl trong môi trường nước", category: "Chemicals & Paint", keywords: "water-based paint, acrylic" },
  { code: "3214.10", en: "Glaziers' putty, resin cements, mastics, caulking (sealants)", vn: "Ma tít, keo trám, chất bịt kín (sealant)", category: "Chemicals & Paint", keywords: "sealant, silicone, caulk, mastic" },
  { code: "3506.91", en: "Adhesives based on polymers or rubber", vn: "Keo dán gốc polyme hoặc cao su", category: "Chemicals & Paint", keywords: "adhesive, glue, contact cement" },
  { code: "3403.19", en: "Lubricating preparations containing petroleum oils, other", vn: "Chế phẩm bôi trơn chứa dầu mỏ, loại khác", category: "Chemicals & Paint", keywords: "lubricant, grease, oil" },
  { code: "3810.90", en: "Soldering/welding fluxes and auxiliary preparations, other", vn: "Chất trợ dung hàn và chế phẩm phụ trợ, loại khác", category: "Chemicals & Paint", keywords: "flux, welding flux" },
  { code: "2710.19", en: "Petroleum oils (lubricating oils and greases), other", vn: "Dầu mỏ (dầu bôi trơn và mỡ), loại khác", category: "Chemicals & Paint", keywords: "compressor oil, refrigeration oil, hydraulic oil" },
  { code: "2903.79", en: "Halogenated derivatives of hydrocarbons, other (refrigerant)", vn: "Dẫn xuất halogen hóa của hydrocacbon, loại khác (môi chất lạnh)", category: "Chemicals & Paint", keywords: "refrigerant, HFC, gas — confirm exact HFC subheading" },
];
