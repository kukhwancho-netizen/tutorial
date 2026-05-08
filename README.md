# 세무기장대리 서비스

세무사 사무소와 고객사가 함께 사용하는 멀티테넌트 기장대리 플랫폼 MVP.
2025년 귀속(2026년 신고분) 한국 세율 기준.

## 스택

- **Next.js 14 (App Router) + TypeScript + Tailwind CSS**
- **Prisma + SQLite** (개발), 프로덕션은 PostgreSQL 권장
- **Vitest** — 세액 계산 로직 단위 테스트

## 기능

**계산기 / 안내**
- 부가가치세 (일반과세 매출/매입)
- 종합소득세 (8단계 누진세율, 인적공제, 표준세액공제, 지방소득세)
- 원천세 (사업소득 3.3% / 기타소득 8.8% / 근로소득 간이세액 추정)
- 4대보험 (국민연금·건강·장기요양·고용·산재)

**기장**
- 복식부기 분개 (`Account` + `JournalEntry` + `JournalLine`)
- 차변=대변 검증
- 분개 기반 부가세 자동 집계 (거래처 상세 페이지)

**보안 / 멀티테넌트**
- HMAC 서명 쿠키 기반 데모 세션 (운영은 NextAuth로 교체)
- 모든 거래처 데이터 접근은 `requireClientAccess` 가드를 거침
- 세무사 ↔ 고객사 N:M (`Membership`) 권한 모델

## 디렉토리

```
src/
  app/                  Next.js 라우트
    calculators/        부가세·종소세·원천세·4대보험 계산기
    clients/            거래처 관리
  components/           UI 컴포넌트 (TenantSwitcher, GuidePanel, MoneyInput)
  lib/
    tax/                세액 계산 엔진 + 안내 콘텐츠
      rates.ts          2025년 세율/요율 (이 파일만 갱신하면 매년 대응)
      vat.ts            부가세
      income.ts         종합소득세 (누진세율, 근로소득공제)
      withholding.ts    원천세
      insurance.ts      4대보험
      guides.ts         세목별 안내문구
      __tests__/        Vitest 테스트
    tenant/              테넌트(세무사/고객사) 컨텍스트
    db.ts               Prisma 클라이언트 싱글톤
prisma/
  schema.prisma         멀티테넌트 데이터 모델
  seed.ts               데모 시드
```

## 시작하기

```bash
cp .env.example .env
npm install
npm run db:push       # Prisma SQLite 스키마 적용
npm run db:seed       # 데모 데이터 삽입
npm run dev           # http://localhost:3000
npm test              # 세액 계산 단위 테스트
```

## 다음 단계

- [ ] NextAuth 도입 + 서버사이드 권한 검증 (현재는 localStorage 기반 데모)
- [ ] 거래처 CRUD + 전표 입력 화면 (Prisma 연동)
- [ ] 부가세 신고서식(매출처별/매입처별 세금계산서합계표) PDF/엑셀 출력
- [ ] 근로소득 간이세액표 정확도 향상 (국세청 lookup 테이블 임포트)
- [ ] 종합소득세 모듈 (사업소득금액 산정, 단순경비율/기준경비율)

## 면책

본 도구는 안내·계산 보조 목적이며 실제 신고는 세무 전문가의 검토를 받으십시오.
세율/요율 변경 시 `src/lib/tax/rates.ts` 만 갱신하면 계산 로직은 그대로 유지됩니다.
