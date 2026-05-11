# 세무기장대리 서비스

세무사 사무소와 고객사가 함께 사용하는 멀티테넌트 기장대리 플랫폼 MVP.
2025년 귀속(2026년 신고분) 한국 세율 기준.

## 한 줄 요약

거래처별로 **분개(기장)를 입력**하면 부가세가 자동 집계되고, **사업자 유형에 맞는 신고 일정**과 **체크리스트**가 표시됩니다. 부가세·종소세·원천세·4대보험 **계산기**는 단독으로도 쓸 수 있습니다.

## 빠른 시작

```bash
cp .env.example .env
npm install
npm run db:push        # SQLite 스키마 적용
npm run db:seed        # 데모 데이터 (세무사·고객사·계정과목)
npm run dev            # http://localhost:3000
```

데모 계정 (비밀번호 없는 데모 모드):
- **세무사**: `accountant@example.com`
- **고객사**: `owner@sample.co.kr`

## 일상 워크플로우

```
[로그인]
  │
  ├─ 헤더에서 활성 고객사 선택 (테넌트 스위처)
  │
  ├─ /clients/[id] ─ 고객사 상세
  │     ├─ [+ 분개 입력]  → 매출/매입 + 공급가액 → 표준 분개 자동 생성 → 부가세 분리
  │     └─ [세무 체크리스트] → 다가오는 30/90/180/365일 마감 항목 + 임박도 표시
  │
  ├─ /calendar ─ 연간 세무달력 (12개월)
  │     사업자 유형별 필터 (법인 / 일반과세 / 간이 / 면세) — 활성 고객사 유형 자동 적용
  │
  └─ /calculators/* ─ 즉석 계산기 (DB 없이도 동작)
        부가세 · 종합소득세 · 원천세 · 4대보험
```

### 1. 분개 입력 (간이 기장)

`/clients/[id]/journal/new` 에서:

| 입력 | 자동 처리 |
| --- | --- |
| 거래일자·거래처·적요 | `JournalEntry`로 저장 |
| 매출 / 매입 구분 | `vatDirection` 설정 (부가세 집계용) |
| 결제: 현금 vs 외상 | 분개 차/대 계정 자동 선택 |
| 공급가액 | 부가세 10% 자동 분리 (면세 체크 시 0) |

저장 즉시 `/clients/[id]` 의 부가세 집계 카드에 반영됩니다.

### 2. 사업자 유형별 신고 항목

| 유형 | 부가세 | 종소세/법인세 | 원천세 | 4대보험 |
| --- | --- | --- | --- | --- |
| **법인사업자** | 분기 (4·7·10·1월) | 법인세 3월·중간예납 8월 | 매월 10일 | 매월 + 연간 보수총액 |
| **개인 일반과세** | 반기 (7·1월) | 종소세 5월 + 중간예납 11월 | 매월 10일 | 매월 + 연간 |
| **간이과세** | 연 1회 (1월) | 종소세 5월 | 매월 10일 | 매월 + 연간 |
| **면세사업자** | 사업장현황신고 2/10 | 종소세 5월 | 매월 10일 | 매월 + 연간 |

전체 데이터는 `src/lib/tax/calendar.ts` 단일 파일에서 관리 — 법령 변경 시 본 파일만 갱신.

## 아키텍처

```
src/
  app/                          Next.js App Router
    page.tsx                    대시보드
    login/                      로그인 (HMAC 서명 쿠키 데모)
    clients/
      page.tsx                  거래처 목록
      [id]/
        page.tsx                고객사 상세 + VAT 집계
        checklist/page.tsx      📅 다가오는 신고 항목
        journal/new/            📝 분개 입력 폼 + server action
    calendar/page.tsx           📅 연간 세무달력 (12개월)
    calculators/                즉석 계산기 (DB 불필요)
      vat | income | withholding | insurance
    error.tsx / not-found.tsx   한국어 폴백
  components/                   TenantSwitcher, MoneyInput, GuidePanel ...
  lib/
    tax/
      calendar.ts               🗓️ 세무 이벤트 단일 소스 (필터/정렬 헬퍼)
      rates.ts                  세율/요율 (2025년 귀속)
      vat.ts / income.ts / withholding.ts / insurance.ts
      guides.ts                 세목별 안내 문구
    accounting/journal.ts       복식부기 분개 헬퍼 + VAT 집계
    auth/
      session.ts                서명 쿠키
      guard.ts                  서버사이드 테넌트 가드 (requireClientAccess)
    db.ts                       Prisma 싱글톤
prisma/
  schema.prisma                 Firm · User · Client · Membership · Account · JournalEntry · JournalLine
  seed.ts                       데모 시드
```

### 데이터 흐름

```
[브라우저]
   │
   ▼
[App Router 페이지/액션]  ─── readSession() → cookies()
   │
   ▼
[requireClientAccess]  ─── Membership/Firm 권한 검증 → 401/403/404
   │ (통과)
   ▼
[Prisma]  ─── SQLite (개발) / PostgreSQL (권장)
```

모든 보호 라우트는 `requireClientAccess`를 거치며, 비로그인 시 `?next=<원래경로>`로 로그인 페이지 리다이렉트 → 로그인 후 원래 페이지로 자동 복귀.

## 보안 / 멀티테넌트

- HMAC-SHA256 서명 쿠키 데모 세션 (운영은 NextAuth로 교체 권장)
- 모든 거래처 데이터는 `requireClientAccess` 가드 통과 후에만 접근
- 세무사 ↔ 고객사 N:M (`Membership`) 권한
- 오픈 리다이렉트 방지: `next` 파라미터는 `/` 시작이고 `//` 아닐 때만 허용

## 명령

```bash
npm run dev           # 개발 서버
npm run build         # 프로덕션 빌드
npm test              # Vitest (33 tests)
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
npm run db:push       # Prisma 스키마 적용
npm run db:seed       # 데모 데이터
npm run demo          # 권한 가드 + 분개 + VAT 시나리오 출력 (scripts/demo.ts)
```

## 면책

본 도구는 안내·계산 보조 목적이며 실제 신고는 세무 전문가의 검토를 받으십시오. 휴일·천재지변 시 마감일은 국세청 고시로 연장될 수 있습니다.
