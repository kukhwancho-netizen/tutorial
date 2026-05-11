// 홈택스에서 다운로드한 매출/매입 세금계산서 합계표(XLSX/CSV)를 파싱.
// 컬럼명·시트명 변동을 견디도록 자동 매핑.
//
// 입력 가정:
//   - 한 행 = 한 거래 (또는 한 거래처별 집계)
//   - 헤더 행이 첫 데이터 행 위에 있음 (위 1~3행에 타이틀이 있을 수 있음)
//
// 출력: ImportedRow[] — 우리 시스템의 standard journal entry로 바로 매핑 가능

import * as XLSX from "xlsx";

export type ImportedRow = {
  rowIndex: number; // 원본 행 번호 (1-based, 헤더 제외)
  occurredOn: string; // YYYY-MM-DD
  counterparty: string;
  counterpartyBizNo?: string;
  supplyAmount: number;
  vatAmount: number;
  totalAmount: number;
  /** SALE = 매출, PURCHASE = 매입 */
  direction: "SALE" | "PURCHASE";
  /** 원본 파싱 에러 (있으면 commit 전 사용자에게 노출) */
  warning?: string;
};

export type ParseResult = {
  rows: ImportedRow[];
  errors: Array<{ rowIndex: number; reason: string }>;
  detectedDirection: "SALE" | "PURCHASE" | "MIXED";
};

// ----------------------------------------------------------------------------
// 컬럼 자동 매핑 — 홈택스 양식 + 흔한 변형 모두 처리
// ----------------------------------------------------------------------------

const COLUMN_PATTERNS: Record<keyof Omit<ImportedRow, "rowIndex" | "warning" | "direction">, RegExp[]> = {
  occurredOn: [/거래일자/, /작성일자/, /발급일자/, /^일자$/, /^날짜$/, /date/i],
  counterparty: [/거래처/, /상호/, /매출처/, /매입처/, /공급(자|받는자)/, /업체명/, /name/i],
  counterpartyBizNo: [/사업자등록번호/, /사업자번호/, /등록번호/, /biz.*no/i],
  supplyAmount: [/공급가액/, /과세표준/, /매출액(?!.*세액)/, /매입액(?!.*세액)/, /supply/i],
  vatAmount: [/^세액$/, /부가세/, /^부가가치세액?$/, /vat/i, /tax(?!.*invoice)/i],
  totalAmount: [/합계/, /합계금액/, /총액/, /^금액$/, /total/i],
};

const DIRECTION_HINT: Record<"SALE" | "PURCHASE", RegExp[]> = {
  SALE: [/매출/, /sales?/i, /공급한/],
  PURCHASE: [/매입/, /purchase/i, /공급받은/],
};

type ColumnMap = Partial<Record<keyof typeof COLUMN_PATTERNS, number>>;

function matchColumn(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  for (const key of Object.keys(COLUMN_PATTERNS) as Array<keyof typeof COLUMN_PATTERNS>) {
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i] ?? "").trim();
      if (!h) continue;
      if (map[key] !== undefined) break;
      for (const re of COLUMN_PATTERNS[key]) {
        if (re.test(h)) {
          map[key] = i;
          break;
        }
      }
    }
  }
  return map;
}

function detectDirectionFromHeaders(headers: string[], sheetName: string): "SALE" | "PURCHASE" | "MIXED" {
  const joined = headers.join(" ") + " " + sheetName;
  const hasSale = DIRECTION_HINT.SALE.some((r) => r.test(joined));
  const hasPurchase = DIRECTION_HINT.PURCHASE.some((r) => r.test(joined));
  if (hasSale && !hasPurchase) return "SALE";
  if (hasPurchase && !hasSale) return "PURCHASE";
  return "MIXED";
}

// ----------------------------------------------------------------------------
// 값 파싱
// ----------------------------------------------------------------------------

function parseAmount(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number") return Math.round(raw);
  const cleaned = String(raw).replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function parseDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "number") {
    // XLSX 일련번호 (1900 기준)
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
    }
    return null;
  }
  const s = String(raw).trim();
  // 다양한 한국식 표기
  const m =
    s.match(/^(\d{4})[.\-\/년]\s*(\d{1,2})[.\-\/월]\s*(\d{1,2})[일\s]?$/) ||
    s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function normalizeBizNo(raw: unknown): string | undefined {
  if (raw == null || raw === "") return undefined;
  const digits = String(raw).replace(/[^0-9]/g, "");
  if (digits.length !== 10) return undefined;
  return digits;
}

// ----------------------------------------------------------------------------
// 헤더 행 자동 위치 탐지 — 매핑된 컬럼이 가장 많은 행을 헤더로 본다
// ----------------------------------------------------------------------------

function detectHeaderRowIndex(rows: unknown[][]): { headerIndex: number; map: ColumnMap } {
  let best = { headerIndex: -1, map: {} as ColumnMap, score: 0 };
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const headers = (rows[i] ?? []).map((c) => String(c ?? "").trim());
    const map = matchColumn(headers);
    const score = Object.keys(map).length;
    if (score > best.score) best = { headerIndex: i, map, score };
  }
  return { headerIndex: best.headerIndex, map: best.map };
}

// ----------------------------------------------------------------------------
// 핵심 파싱 — Sheet → ImportedRow[]
// ----------------------------------------------------------------------------

export type ParseOptions = {
  /** 명시적 방향 지정. 미지정이면 헤더/시트명에서 추론, 모호하면 SALE. */
  direction?: "SALE" | "PURCHASE";
};

export function parseSheet(
  rows: unknown[][],
  sheetName: string,
  opts: ParseOptions = {},
): ParseResult {
  const errors: ParseResult["errors"] = [];
  const result: ImportedRow[] = [];

  const { headerIndex, map } = detectHeaderRowIndex(rows);
  if (headerIndex < 0 || map.occurredOn === undefined || map.supplyAmount === undefined) {
    return {
      rows: [],
      errors: [{ rowIndex: 0, reason: "헤더에서 거래일자/공급가액 컬럼을 찾지 못했습니다." }],
      detectedDirection: "MIXED",
    };
  }

  const headers = (rows[headerIndex] ?? []).map((c) => String(c ?? ""));
  const detected = detectDirectionFromHeaders(headers, sheetName);
  const direction: "SALE" | "PURCHASE" = opts.direction
    ? opts.direction
    : detected === "PURCHASE"
      ? "PURCHASE"
      : "SALE";

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c == null || c === "")) continue;

    const occurredOn = parseDate(row[map.occurredOn!]);
    const counterparty = String(row[map.counterparty ?? -1] ?? "").trim();
    const supplyAmount = parseAmount(row[map.supplyAmount!]);
    const vatAmount = parseAmount(row[map.vatAmount ?? -1]);
    const totalRaw = parseAmount(row[map.totalAmount ?? -1]);
    const totalAmount = totalRaw || supplyAmount + vatAmount;
    const counterpartyBizNo = normalizeBizNo(row[map.counterpartyBizNo ?? -1]);

    const rowIndex = r + 1; // 1-based for user

    if (!occurredOn) {
      errors.push({ rowIndex, reason: "거래일자 파싱 실패" });
      continue;
    }
    if (!counterparty) {
      errors.push({ rowIndex, reason: "거래처(상호) 없음" });
      continue;
    }
    if (supplyAmount <= 0) {
      errors.push({ rowIndex, reason: "공급가액 0 또는 음수" });
      continue;
    }

    let warning: string | undefined;
    // 부가세 / 합계 / 공급가액 정합성 약한 검증
    if (vatAmount > 0 && supplyAmount > 0) {
      const expected = Math.round(supplyAmount * 0.1);
      const drift = Math.abs(vatAmount - expected);
      if (drift > 10) warning = `부가세 ${vatAmount.toLocaleString()}원이 공급가액 10%와 차이가 큽니다(차 ${drift.toLocaleString()}원).`;
    }

    result.push({
      rowIndex,
      occurredOn,
      counterparty,
      counterpartyBizNo,
      supplyAmount,
      vatAmount,
      totalAmount,
      direction,
      warning,
    });
  }

  return { rows: result, errors, detectedDirection: detected };
}

// ----------------------------------------------------------------------------
// 입력 진입점 — File Buffer / CSV 문자열 → ParseResult
// ----------------------------------------------------------------------------

export function parseHometaxXlsx(buffer: ArrayBuffer | Buffer, opts: ParseOptions = {}): ParseResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ rowIndex: 0, reason: "시트가 없습니다." }], detectedDirection: "MIXED" };
  }
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  return parseSheet(rows, sheetName, opts);
}

export function parseHometaxCsv(text: string, opts: ParseOptions = {}): ParseResult {
  // 간이 CSV 파서 (따옴표 처리 포함). 큰 파일·복잡한 케이스는 xlsx 권장.
  const lines = text.split(/\r?\n/);
  const rows: string[][] = lines.map((line) => parseCsvLine(line));
  return parseSheet(rows, "csv", opts);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuote = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
