import path from "path";
import { Font } from "@react-pdf/renderer";

/**
 * §22.4: @react-pdf default fonts break Vietnamese diacritics (ế, ữ, đ…). All PDF text uses the
 * bundled Be Vietnam Pro TTFs (full Vietnamese coverage). Register once per process.
 */
let registered = false;

export function registerPdfFonts() {
  if (registered) return;
  registered = true;
  const dir = path.join(process.cwd(), "lib", "pdf", "fonts");
  Font.register({
    family: "BeVietnamPro",
    fonts: [
      { src: path.join(dir, "BeVietnamPro-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "BeVietnamPro-Bold.ttf"), fontWeight: 700 },
      { src: path.join(dir, "BeVietnamPro-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
    ],
  });
  // never hyphenate Vietnamese words
  Font.registerHyphenationCallback((word) => [word]);
}
