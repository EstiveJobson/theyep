import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { cookies } from "next/headers";
import { Shell } from "@/components/shell";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

const themeInit = `(function(){try{var k="theyep-theme";var s=localStorage.getItem(k);var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"#212121":"#FFFFFF");}catch(e){}})();`;

export const metadata: Metadata = {
  title: "TheYep",
  description: "Uma rede simples para a escola.",
  applicationName: "TheYep",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "TheYep",
    statusBarStyle: "default",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#212121" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theyep-theme")?.value;
  const themeClass = theme === "dark" ? "dark" : "";

  return (
    <html lang="pt-BR" className={`${nunito.variable} ${themeClass}`.trim()} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script id="theyep-theme" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInit }} />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
