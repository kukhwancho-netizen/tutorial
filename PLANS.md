# PLANS — 세무기장대리 서비스

## ✅ Phase 1 (완료): 골격 + 계산/안내 엔진

- Next.js 14 + TS + Tailwind 프로젝트 골격
- 2025년 귀속 세액 계산 라이브러리 (부가세·종합소득세·원천세·4대보험)
- 안내 콘텐츠 (`guides.ts`) + Vitest 테스트
- 4개 계산기 페이지 + 거래처 목록 + 멀티테넌트 토글

## ✅ Phase 2 (완료): 서버사이드 격리 + 복식부기

- HMAC 서명 쿠키 기반 데모 세션 (`src/lib/auth/session.ts`)
- 서버사이드 테넌트 가드 (`requireClientAccess` / `listAccessibleClients`)
- 로그인/로그아웃/테넌트 전환 Server Action
- 복식부기 분개 모델 (`Account` + `JournalEntry` + `JournalLine`)
- 차변=대변 검증 (`assertBalanced`)
- 거래처 상세 페이지: 분개 기반 부가세 자동 집계

## 🔜 Phase 3: 입력·신고

- [ ] 분개 입력 화면 (매출/매입 표준 분개 자동 생성)
- [ ] 부가세 신고서식 출력 (매출처별/매입처별 세금계산서 합계표)
- [ ] 종합소득세 신고용 사업소득금액 산정 (단순경비율/기준경비율)
- [ ] 원천징수이행상황신고서 (매월/반기)
- [ ] 근로소득 간이세액표 (국세청 lookup) 임포트

## 🔜 Phase 4: 운영

- [ ] NextAuth(Email/Magic Link) — 데모 세션 교체
- [ ] PostgreSQL 마이그레이션 + 행 수준 보안(RLS)
- [ ] 금액 타입을 `Decimal`로 전환
- [ ] 안내 콘텐츠 CMS화 (MDX 또는 Sanity)
- [ ] 영수증 OCR / 카드매입 자동수집
- [ ] 신고 마감 D-3 알림
