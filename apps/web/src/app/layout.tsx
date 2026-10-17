import type { Metadata } from "next";
import "@/app/globals.css";
import "@/styles/library.css";
import "@/styles/components.css";
import "@/styles/reader.css";
import "@/styles/chat.css";

export const metadata: Metadata = {
  title: "Bunko",
  description: "Bunko (文庫): a personal library you walk through, read in, and talk about with an AI that never spoils what you haven't read.",
};

const FONTS =
  "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&family=Noto+Serif+SC:wght@400;600&family=Orbitron:wght@500;700&family=Space+Grotesk:wght@400;500;600&family=Shippori+Mincho:wght@500;700&family=Tiro+Devanagari+Sanskrit&family=Yatra+One&family=ZCOOL+XiaoWei&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
