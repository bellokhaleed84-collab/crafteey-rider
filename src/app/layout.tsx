import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import ClientRoot from "@/components/ClientRoot";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Crafteey Rider",
  description: "Accept and manage delivery requests as a Crafteey courier.",
};

const THEME_INIT_SCRIPT = `
(function() {
  try {
    var saved = localStorage.getItem("crafteey_rider_theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var dark = saved === "dark" || (saved !== "light" && prefersDark);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${spaceGrotesk.variable} ${inter.variable} font-body`}>
        <AuthProvider>
          <ClientRoot>{children}</ClientRoot>
        </AuthProvider>
      </body>
    </html>
  );
}