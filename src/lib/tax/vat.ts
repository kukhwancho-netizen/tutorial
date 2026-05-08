import { VAT } from "./rates";

export type VatLine = {
  /** 공급가액(원). 합계금액에서 부가세를 분리하기 전 값 */
  supplyAmount: number;
};

export type VatPeriodInput = {
  sales: VatLine[];
  purchases: VatLine[];
};

export type VatPeriodResult = {
  outputVat: number; // 매출세액
  inputVat: number; // 매입세액
  payable: number; // 납부(환급)세액. 음수면 환급
  totalSalesSupply: number;
  totalPurchaseSupply: number;
};

/** 일반과세자(매출 - 매입) × 10% 모델 */
export function calcGeneralVat(input: VatPeriodInput): VatPeriodResult {
  const totalSalesSupply = sum(input.sales.map((l) => l.supplyAmount));
  const totalPurchaseSupply = sum(input.purchases.map((l) => l.supplyAmount));

  const outputVat = Math.floor(totalSalesSupply * VAT.standardRate);
  const inputVat = Math.floor(totalPurchaseSupply * VAT.standardRate);
  return {
    outputVat,
    inputVat,
    payable: outputVat - inputVat,
    totalSalesSupply,
    totalPurchaseSupply,
  };
}

/** 합계금액(부가세 포함)에서 공급가액·부가세를 분리 */
export function splitVatFromTotal(total: number) {
  const supply = Math.round(total / 1.1);
  const vat = total - supply;
  return { supply, vat };
}

/** 간이과세자: 공급대가 × 업종별 부가율 × 10% - 세금계산서 매입세액공제(0.5%) */
export function calcSimplifiedVat(params: {
  supplyTotal: number; // 공급대가(부가세 포함 매출)
  industryRate: number; // VAT.simplifiedRates 중 하나
  taxInvoicePurchases: number; // 세금계산서 수취 매입대가
}): { tax: number; deduction: number; payable: number } {
  const tax = Math.floor(params.supplyTotal * params.industryRate * VAT.standardRate);
  const deduction = Math.floor(params.taxInvoicePurchases * 0.005);
  return { tax, deduction, payable: Math.max(0, tax - deduction) };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
