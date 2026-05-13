import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { TenantSwitcher } from "@/components/TenantSwitcher";

export const metadata: Metadata = {
  title: "세무기장대리 서비스",
  description: "세무사·고객사 멀티테넌트 기장대리 플랫폼 (2025년 귀속)",
};

const NAV = [
  { href: "/", label: "대시보드" },
  { href: "/clients", label: "거래처" },
  { href: "/calendar", label: "세무달력" },
  { href: "/help/sites", label: "📘 사이트 사용법" },
  { href: "/help/industry", label: "🏷️ 업종별 안내" },
  { href: "/calculators/payroll", label: "월급" },
  { href: "/calculators/vat", label: "부가세" },
  { href: "/calculators/income", label: "종합소득세" },
  { href: "/calculators/withholding", label: "원천세" },
  { href: "/calculators/insurance", label: "4대보험" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <Link href="/" className="text-lg font-semibold text-brand-700">
              세무기장대리
            </Link>
            <TenantSwitcher />
          </div>
          <nav className="mx-auto max-w-6xl px-6 pb-3">
            <ul className="flex flex-wrap gap-4 text-sm text-slate-600">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="hover:text-brand-600">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 py-6 text-xs text-slate-400">
          본 도구는 2025년 귀속(2026년 신고분) 세율을 사용한 안내용 계산기이며, 실제 신고는 세무
          전문가의 검토를 받으시기 바랍니다.
        </footer>
      </body>
    </html>
  );
}
