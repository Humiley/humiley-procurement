import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";

// The portal's typeface — Poppins carries its whole "Crextio" look. Self-hosted by next/font
// (no runtime CDN), exposed as --font-poppins and used as the primary sans in globals.css.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: t("name"), description: t("tagline") };
}

// Extend under the iOS notch / home indicator so safe-area insets work (portal parity).
export const viewport: Viewport = { viewportFit: "cover", themeColor: "#205090" };

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    // data-scroll-behavior: globals.css sets `scroll-behavior: smooth` on <html>. Up to Next 15 the
    // router switched it off for the jump to the top of a new page; Next 16 only does so when this
    // attribute is present. Without it, every navigation would smooth-scroll up from where the last
    // page was left.
    <html lang={locale} className={poppins.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="min-h-full text-body antialiased">
        {/* When the Humiley Portal embeds this app in an iframe (Procurement as an in-portal
            section), mark the root so our own top bar is hidden — the portal already provides the
            user menu, language toggle and notifications. Runs before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(window.self!==window.top){document.documentElement.setAttribute('data-embed','1')}}catch(e){document.documentElement.setAttribute('data-embed','1')}",
          }}
        />
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
