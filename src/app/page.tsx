import Link from "next/link";

const FEATURES = [
  {
    href: "/calendar",
    title: "연간 세무달력",
    desc: "사업자 유형별 신고·납부 마감일을 12개월 한눈에. 매월 반복(원천세·4대보험) 포함.",
  },
  {
    href: "/clients",
    title: "거래처 관리",
    desc: "고객사별 분개 입력·부가세 집계·세무 체크리스트를 확인합니다.",
  },
  {
    href: "/calculators/payroll",
    title: "월급 통합 계산기",
    desc: "총급여+비과세 입력하면 4대보험·원천세·실수령액·사업주 총인건비를 한 번에 산출.",
  },
  {
    href: "/calculators/vat",
    title: "부가가치세 계산기",
    desc: "매출·매입 공급가액을 입력하면 납부세액을 산출합니다.",
  },
  {
    href: "/calculators/income",
    title: "종합소득세 계산기",
    desc: "8단계 누진세율(2025년 귀속) 기준으로 산출세액을 계산합니다.",
  },
  {
    href: "/calculators/withholding",
    title: "원천세 계산기",
    desc: "프리랜서 3.3% / 기타소득 8.8% / 근로소득 간이세액을 계산합니다.",
  },
  {
    href: "/calculators/insurance",
    title: "4대보험 계산기",
    desc: "월보수 기준 근로자·사업주 부담분을 계산합니다.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-8 text-white">
        <h1 className="text-2xl font-semibold">세무기장대리 서비스</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed opacity-90">
          세무사 사무소와 고객사가 함께 사용하는 멀티테넌트 기장대리 플랫폼입니다. 부가세·종합소득
          세·원천세·4대보험 계산과 신고 일정 안내를 제공합니다. 본 버전은 2025년 귀속(2026년
          신고분) 세율 기준입니다.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="rounded-lg border border-slate-200 bg-white p-5 transition hover:border-brand-500 hover:shadow"
          >
            <h2 className="font-semibold text-slate-800">{f.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
