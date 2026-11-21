import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Simulador MCX · AppyPay sandbox",
  description: "Simula pagamentos Multicaixa Express e por referência na conta de teste da AppyPay.",
  robots: { index: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt" className={`${inter.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
