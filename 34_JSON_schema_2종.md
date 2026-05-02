# JSON Schema 2종 정의

**계층**: L4 내부 검토 라인  
**상위 참조**: L0 `00_파이프라인_v3_최상위_구조.md`  
**역할**: JSON schema 2종 - 검토자 판정 + 작성자 메타 필드  
**L0 참조 헤더 추가**: 2026.04.23  

작성: 2026.04.23  
용도: ChatGPT Custom GPT 이식 환경에서 **출력 구조 기준 문서**로 사용한다.  
적용 대상:
- Schema A: R1·R2·R3 검토자 판정 출력
- Schema B: 작성 단계 메타 필드 (규칙 8 태그 강제)

---

## 실행 메모

- **기본형(Custom GPT 단일 실행)**: 아래 schema는 자동 강제 장치가 아니라, Knowledge에 올려 두고 출력 형식을 맞추는 기준 문서로 사용한다.
- **강화형(선택)**: 외부 검증 액션 또는 별도 OpenAI API 오케스트레이터를 둘 경우, 같은 schema를 그대로 검증 규칙으로 재사용한다.
- 본문 자연문 전체를 schema로 묶으려 하지 말고, 메타 필드와 판정 결과에만 적용한다.

---

## Schema A — 검토자 판정 출력 Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ReviewerVerdict",
  "type": "object",
  "required": ["reviewer", "verdict", "checks"],
  "properties": {
    "reviewer": {
      "type": "string",
      "enum": ["R1", "R2", "R3"]
    },
    "verdict": {
      "type": "string",
      "enum": ["pass", "partial", "fail"]
    },
    "one_line_conclusion": {
      "type": "string",
      "minLength": 5,
      "maxLength": 200
    },
    "checks": {
      "type": "array",
      "minItems": 5,
      "items": {
        "type": "object",
        "required": ["item_id", "item_name", "status", "violations"],
        "properties": {
          "item_id": {
            "type": "string",
            "pattern": "^(R[123])-(item-[1-9]|item-1[01])$"
          },
          "item_name": {
            "type": "string",
            "minLength": 3
          },
          "status": {
            "type": "string",
            "enum": ["pass", "partial", "fail", "n/a"]
          },
          "violations": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["quote", "reason"],
              "properties": {
                "quote": {
                  "type": "string",
                  "minLength": 1
                },
                "reason": {
                  "type": "string",
                  "minLength": 10
                },
                "rule_ref": {
                  "type": "string",
                  "pattern": "^(규칙 [89]|규칙 10-[1234]|규칙 11|게이트 [1-5])$"
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### 필드 설명
- `reviewer`: R1·R2·R3 중 하나
- `verdict`: 전체 판정
- `checks`: 항목별 판정 배열
- `violations`: 위반 없으면 `[]`, 있으면 `quote + reason + rule_ref`

---

## Schema B — 작성자 메타 필드 Schema (v1.10 채널별 태그·FAQ 조건 분리)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ContentMetaFields",
  "type": "object",
  "required": [
    "content_id",
    "channel",
    "field_data",
    "claims"
  ],
  "properties": {
    "content_id": {
      "type": "string",
      "pattern": "^(BL|HP)-\\d{3}$"
    },
    "channel": {
      "type": "string",
      "enum": [
        "블로그",
        "홈페이지"
      ]
    },
    "field_data": {
      "type": "object",
      "required": [
        "keywords",
        "tags",
        "faq_count"
      ],
      "properties": {
        "keywords": {
          "type": "object",
          "required": [
            "primary_naver",
            "primary_google_ai",
            "secondary",
            "longtail",
            "practical",
            "local",
            "title_reflected",
            "intro_reflected",
            "ai_friendly_section"
          ],
          "properties": {
            "primary_naver": {
              "type": "string",
              "minLength": 2
            },
            "primary_google_ai": {
              "type": "string",
              "minLength": 5
            },
            "secondary": {
              "type": "array",
              "minItems": 2,
              "maxItems": 3,
              "items": {
                "type": "string"
              }
            },
            "longtail": {
              "type": "array",
              "minItems": 2,
              "maxItems": 4,
              "items": {
                "type": "string"
              }
            },
            "practical": {
              "type": "array",
              "minItems": 2,
              "maxItems": 4,
              "items": {
                "type": "string"
              }
            },
            "local": {
              "type": "array",
              "minItems": 0,
              "maxItems": 2,
              "items": {
                "type": "string"
              }
            },
            "title_reflected": {
              "type": "array",
              "minItems": 1,
              "maxItems": 2,
              "items": {
                "type": "string"
              }
            },
            "intro_reflected": {
              "type": "array",
              "minItems": 1,
              "maxItems": 2,
              "items": {
                "type": "string"
              }
            },
            "ai_friendly_section": {
              "type": "string"
            }
          }
        },
        "tags": {
          "type": "object",
          "required": [
            "representative",
            "secondary",
            "practical",
            "local",
            "excluded",
            "total_count"
          ],
          "properties": {
            "representative": {
              "type": "array",
              "items": {
                "type": "string",
                "pattern": "^#"
              }
            },
            "secondary": {
              "type": "array",
              "items": {
                "type": "string",
                "pattern": "^#"
              }
            },
            "practical": {
              "type": "array",
              "items": {
                "type": "string",
                "pattern": "^#"
              }
            },
            "local": {
              "type": "array",
              "items": {
                "type": "string",
                "pattern": "^#"
              }
            },
            "excluded": {
              "type": "array",
              "minItems": 1,
              "maxItems": 3,
              "items": {
                "type": "string"
              }
            },
            "total_count": {
              "type": "integer",
              "minimum": 3,
              "maximum": 8
            }
          }
        },
        "faq_count": {
          "type": "integer",
          "minimum": 2,
          "maximum": 6
        }
      }
    },
    "claims": {
      "type": "array",
      "description": "산출물 내 수치·평가에 대한 태그 + 근거. 공개 본문 직접 노출용이 아니라 메타 필드용이다.",
      "items": {
        "type": "object",
        "required": [
          "value",
          "tag",
          "source"
        ],
        "properties": {
          "value": {
            "type": "string",
            "minLength": 1
          },
          "tag": {
            "type": "string",
            "enum": [
              "실측",
              "추정",
              "원칙",
              "관례"
            ]
          },
          "source": {
            "type": "string",
            "minLength": 10
          }
        }
      }
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "channel": {
            "const": "블로그"
          }
        }
      },
      "then": {
        "properties": {
          "field_data": {
            "properties": {
              "tags": {
                "properties": {
                  "representative": {
                    "minItems": 2,
                    "maxItems": 3
                  },
                  "secondary": {
                    "minItems": 2,
                    "maxItems": 4
                  },
                  "practical": {
                    "minItems": 1,
                    "maxItems": 3
                  },
                  "local": {
                    "minItems": 0,
                    "maxItems": 2
                  },
                  "total_count": {
                    "minimum": 5,
                    "maximum": 8
                  }
                }
              },
              "faq_count": {
                "minimum": 2,
                "maximum": 3
              }
            }
          }
        }
      }
    },
    {
      "if": {
        "properties": {
          "channel": {
            "const": "홈페이지"
          }
        }
      },
      "then": {
        "properties": {
          "field_data": {
            "properties": {
              "tags": {
                "properties": {
                  "representative": {
                    "minItems": 1,
                    "maxItems": 2
                  },
                  "secondary": {
                    "minItems": 1,
                    "maxItems": 2
                  },
                  "practical": {
                    "minItems": 1,
                    "maxItems": 2
                  },
                  "local": {
                    "minItems": 0,
                    "maxItems": 1
                  },
                  "total_count": {
                    "minimum": 3,
                    "maximum": 6
                  }
                }
              },
              "faq_count": {
                "minimum": 4,
                "maximum": 6
              }
            }
          }
        }
      }
    }
  ]
}
```

### v1.10 적용 메모
- 기존 tags 하위 공통 `minItems/maxItems`는 제거하고, channel 조건부 schema에서만 강제한다.
- 블로그: 태그 총 5~8, FAQ 2~3.
- 홈페이지: 태그 총 3~6, FAQ 4~6.
- Schema B는 트랙 1(블로그·홈페이지) 작성 단계 메타 필드 기준이다. 인스타그램은 옥토리타스 차터의 별도 형식을 따른다.
- 답변형 AI 질의, 팀 탐색형 질의, 팀 엔티티 앵커, 유입 가설, 검색 경로 역산 원칙은 Schema B에 넣지 않는다. 해당 항목은 자연어 판단 필드이며 Phase 1c·2b 자연어 검수에 맡긴다.
- 키워드 전략의 로컬 필드는 0~2개로 본다. 주제상 로컬 본질성이 없으면 `해당 없음 [근거]`로 처리한다.
- Schema B는 본문 자연문 전체가 아니라 작성 단계 메타 필드 기준이다.

## 적용 범위 요약

| 대상 | Schema A | Schema B |
|---|---|---|
| R1 규칙 감사관 판정 | ✅ | — |
| R2 법률 검수관 판정 | ✅ | — |
| R3 문서 검토관 판정 | ✅ | — |
| 작성 단계 메타 필드 | — | ✅ |
| 본문 자연문 | — | — |

끝.
