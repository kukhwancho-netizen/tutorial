# 첫 사이클 대화 예시

Claude Project를 셋업한 직후 어떤 입출력이 정상인지 비교용. 실제 응답은 모델·시점에 따라 세부가 달라지지만 **구조와 필드 셋**은 본 예시와 같아야 한다.

---

## Round 1 — spec sketch

### 사용자 입력
```
블 (민+가+행) 7 ㄱㄱ
```

### 정상 응답 모양
- 자연어 짧은 한 줄 (예: "블로그 7건 토픽을 민/가/행 분배로 잡아드리겠습니다.")
- 코드 블록 1개에 JSON 객체 (스키마: `WeeklySpecBatch`)

```json
{
  "order": "블 (민+가+행) 7 ㄱㄱ",
  "basis_date": "2026-05-04",
  "context_summary": {
    "calendar_window": "조회 안 됨 (Project 환경)",
    "used_sources": ["20_FRWRITER", "Knowledge에 첨부된 규칙"],
    "excluded_sources": ["calendar API 미사용"],
    "duplicate_scan_basis": ["사용자가 직접 확인 필요"]
  },
  "items": [
    {"temp_id": "콘텐츠 1", "channel": "블로그", "topic": "...", "risk_hint": "low", "rationale": "..."},
    {"temp_id": "콘텐츠 2", "channel": "블로그", "topic": "...", "risk_hint": "medium", "rationale": "..."},
    ...
    {"temp_id": "콘텐츠 7", "channel": "블로그", "topic": "...", "risk_hint": "low"}
  ],
  "batch_risk": "medium",
  "handoff": "사용자 검토 후 draft 명령으로 본문화."
}
```

**확인 포인트**:
- items 정확히 7건
- temp_id가 "콘텐츠 1" ~ "콘텐츠 7"
- channel은 모두 "블로그" (사용자 입력 `블`)
- 분배: 민사 ~3건, 가사 ~2건, 행정 ~2건 (대략)
- 본문·outline·키워드·태그·claims **없음** (sketch는 토픽만)

**비정상 신호**:
- items에 `must_include`, `outline`, `keyword_strategy` 같은 옛 필드가 들어 있음 → Knowledge에 옛 spec_batch.schema.json 잘못 올렸거나 Custom Instructions가 옛 버전
- temp_id 형식이 다름 → spec_batch.schema.json의 pattern을 Claude가 안 보고 있음
- 자연어 응답이 길게 풀리고 JSON이 코드 블록 밖에 있음 → "출력 원칙: 모든 데이터 출력은 JSON 객체 1개" 강조 필요

---

## Round 2 — draft 본문

### 사용자 입력
```
draft 콘텐츠 3 길이 풀+요약+핵심

parent:
{
  "temp_id": "콘텐츠 3",
  "channel": "블로그",
  "topic": "계약 해제 뒤 손해배상 청구에서 놓치는 항목",
  "risk_hint": "medium",
  "rationale": "민사 일반 — 잦은 상담 주제"
}
```

### 정상 응답 모양 (4 코드 블록 — draft + R1 + R2 + R3 + 최종 한 줄)

**1. draft batch JSON**:
```json
{
  "order": "draft 콘텐츠 3 길이 풀+요약+핵심",
  "basis_date": "2026-05-04",
  "parent_spec_id": "콘텐츠 3",
  "parent_basis_date": "2026-05-04",
  "axis": "길이",
  "items": [
    {
      "temp_id": "콘텐츠 3.풀",
      "axis_value": "풀",
      "title": "계약 해제 뒤 손해배상 — 풀버전",
      "lede": "계약을 해제하셨다면 ...",
      "body_outline": ["배경", "법적 출발점", "확인 순서", "주의 지점", "다음 단계"],
      "body_paragraphs": ["...", "...", "...", "..."],
      "claims": [{"value": "...", "tag": "원칙", "source": "민법 543조 일반론"}],
      "tone_profile": "법률상담",
      "length_target": {"min_chars": 800, "max_chars": 1500},
      "risk": {"level": "medium", "reason": "...", "human_gate_required": false},
      "status": "publish_candidate"
    },
    {"temp_id": "콘텐츠 3.요", ...},
    {"temp_id": "콘텐츠 3.핵", ...}
  ],
  "batch_risk": "medium",
  "handoff": "..."
}
```

**2. R1 (규칙 감사) 결과 JSON**: per_item 3건, 각 status는 pass/partial/fail/skipped 중 하나.

**3. R2 (법률 검수) 결과 JSON**: 본문의 법령·시행일·금액 인용을 본다. source 없는 단정 표현 있으면 partial 이상.

**4. R3 (문서 검토) 결과 JSON**: 종결어미·1인칭·tone_profile 일치 확인.

**5. 자연어 한 줄 최종 판정**: 예: `[최종: 통과]` 또는 `[최종: 수정 필요 — R2 partial: 시행일 단정 1건]` 또는 `[최종: 보류 — R1 fail: temp_id 형식 위반]`.

**확인 포인트**:
- items 정확히 3건 (variants 개수 = 풀+요약+핵심 = 3)
- temp_id가 "콘텐츠 3.풀", "콘텐츠 3.요", "콘텐츠 3.핵" (parent + 첫 글자)
- body_paragraphs 각 단락이 50자 이상, 4개 이상
- lede 30자 이상
- claims가 본문 인용을 backing
- R1/R2/R3 결과의 per_item.temp_id가 위 변주들과 정확히 일치

**비정상 신호**:
- items 1건만 (parent_spec_item을 못 받았다는 신호 — 사용자가 parent 첨부했는지 확인)
- body_paragraphs가 50자 미만 (Claude가 지면 절약 모드 — "본문 충분히 길게" 강조)
- claims가 비어 있거나 source가 모호함 ("미상" 등) — 11_draft_generator_system.md 강조

---

## Round 3 — edit 재검수 (사용자 편집 후)

### 사용자 입력
```
edit 콘텐츠 3.풀

<편집된 변주 1건 또는 batch JSON 통째로 붙여넣기>
{
  "temp_id": "콘텐츠 3.풀",
  "axis_value": "풀",
  "title": "계약 해제 뒤 손해배상 청구 — 사용자 편집본",
  "lede": "...",
  "body_paragraphs": ["...사용자가 손본 본문..."],
  "claims": [...],
  ...
}
```

### 정상 응답 모양
- (생성 단계 없음 — 본문은 사용자 입력 그대로)
- R1 / R2 / R3 결과 JSON 각각
- 최종 판정 한 줄

**확인 포인트**:
- 응답에 "draft batch" 새로 만들지 말 것 — 사용자 편집을 절대 임의로 바꾸지 말 것
- 검수가 사용자 편집한 본문을 대상으로 함 (편집 전 옛 본문 X)
- partial/fail이 나오면 사용자에게 어떤 부분을 다시 보라는 evidence 제시

**자동 보정**: R 결과에 fail/partial이 있으면 Claude가 "1회 보정해도 될까요?"라고 묻거나 자동으로 수행. 본 라운드는 명시적 동의 없이는 수행 안 하는 게 안전 (사용자 의도 보존). PROJECT_INSTRUCTIONS의 §4 정신.

---

## 명령 모호 / 잘못 인식 시

### 사용자 입력 (모호)
```
콘텐츠 3 좀 다듬어줘
```

### 정상 응답
```
어느 모드로 진행할까요?
- draft 콘텐츠 3 (axis values...) → 본문 변주 새로 생성
- edit 콘텐츠 3.<X> → 기존 변주 재검수
```

→ 디스패처가 모드를 못 정하면 사용자에게 한 줄로 묻는다. 마음대로 spec/draft/edit 중 하나로 가지 말 것.

---

## 압력 분배 검증

본 redesign의 핵심: spec은 가벼움, draft·edit가 무거움. 사이클 한 바퀴 후 비용·시간 분포가 다음과 비슷하면 의도대로 작동.

| 단계 | 응답 시간 (Claude 4) | 응답 길이 (대략) |
|---|---|---|
| spec sketch | 5~15초 | 300~600자 (자연어) + JSON 1.5KB |
| draft 1회 | 30~60초 | JSON 6~12KB (본문 포함) + R1/R2/R3 4KB |
| edit 1회 | 20~40초 | R1/R2/R3 4KB + 최종 판정 |

draft가 가장 비용 큼 (본문 토큰), edit는 검수만이라 절감, spec은 거의 무시할 수준.
