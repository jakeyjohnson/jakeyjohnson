import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { getWorkspace } from "@/lib/workspace";
import { themeToCssVars } from "@/domain/branding";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Loadline",
  description: "Production documentation that issues itself.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const workspace = await getWorkspace();
  const { branding } = workspace;

  return (
    <html
      lang="en-GB"
      data-mode={branding.theme.mode}
      style={themeToCssVars(branding.theme) as React.CSSProperties}
    >
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen`}>
        <header className="border-b border-[var(--rule)]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              {branding.logo && branding.logo.mimeType !== "image/svg+xml" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:${branding.logo.mimeType};base64,${branding.logo.data}`}
                  alt={branding.companyName}
                  className="h-8 w-auto max-w-[180px] object-contain"
                />
              ) : (
                <span
                  className="text-lg font-semibold tracking-tight"
                  style={{ color: "var(--brand-primary)" }}
                >
                  {branding.companyName}
                </span>
              )}
            </Link>

            <nav className="flex items-center gap-6 text-sm">
              <Link href="/" className="hover:underline underline-offset-4">
                Projects
              </Link>
              <Link href="/settings" className="hover:underline underline-offset-4">
                Branding
              </Link>
            </nav>

            <span className="ml-auto text-xs text-[var(--muted)]">
              Loadline
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>

        <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-[var(--muted)] sm:px-6">
          Documents are written to this workspace&rsquo;s folder. Nothing is sent
          anywhere else.
        </footer>
      </body>
    </html>
  );
}
