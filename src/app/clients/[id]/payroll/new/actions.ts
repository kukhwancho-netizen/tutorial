"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, requireClientAccess } from "@/lib/auth/guard";
import { createPayrollEntry } from "@/lib/payroll/payslip";

export type State = { error?: string };

const optStr = z.preprocess((v) => (v == null ? "" : v), z.string());
const num = z
  .preprocess((v) => (v == null ? "0" : v), z.string())
  .transform((s) => Number(String(s).replace(/[^0-9-]/g, "")))
  .pipe(z.number().int());
const posNum = num.pipe(z.number().int().nonnegative());

const Schema = z.object({
  clientId: optStr.pipe(z.string().min(1)),
  payDate: optStr.pipe(z.string().min(1, "지급일을 입력하세요.")),
  employeeName: optStr.pipe(z.string().trim().min(1, "직원 이름을 입력하세요.")),
  grossPay: num.pipe(z.number().int().positive("월급은 0보다 커야 합니다.")),
  nonTaxMeal: posNum.default(0),
  nonTaxCarAllowance: posNum.default(0),
  nonTaxChildcare: posNum.default(0),
  nonTaxOther: posNum.default(0),
  dependents: num.pipe(z.number().int().min(1)).default(1),
  childrenUnder20: posNum.default(0),
  firmSize: z.preprocess((v) => v ?? "SMALL", z.enum(["SMALL", "MID_LARGE"])),
});

export async function createPayrollAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const parsed = Schema.safeParse({
    clientId: formData.get("clientId"),
    payDate: formData.get("payDate"),
    employeeName: formData.get("employeeName"),
    grossPay: formData.get("grossPay"),
    nonTaxMeal: formData.get("nonTaxMeal"),
    nonTaxCarAllowance: formData.get("nonTaxCarAllowance"),
    nonTaxChildcare: formData.get("nonTaxChildcare"),
    nonTaxOther: formData.get("nonTaxOther"),
    dependents: formData.get("dependents"),
    childrenUnder20: formData.get("childrenUnder20"),
    firmSize: formData.get("firmSize"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." };
  }

  try {
    await requireClientAccess(parsed.data.clientId);
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    throw e;
  }

  const payDate = new Date(parsed.data.payDate);
  if (Number.isNaN(payDate.getTime())) {
    return { error: "지급일 형식이 올바르지 않습니다." };
  }

  let entryId = "";
  try {
    const entry = await createPayrollEntry({
      clientId: parsed.data.clientId,
      payDate,
      employeeName: parsed.data.employeeName,
      grossPay: parsed.data.grossPay,
      nonTaxMeal: parsed.data.nonTaxMeal,
      nonTaxCarAllowance: parsed.data.nonTaxCarAllowance,
      nonTaxChildcare: parsed.data.nonTaxChildcare,
      nonTaxOther: parsed.data.nonTaxOther,
      dependents: parsed.data.dependents,
      childrenUnder20: parsed.data.childrenUnder20,
      firmSize: parsed.data.firmSize,
    });
    entryId = entry.id;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  redirect(`/clients/${parsed.data.clientId}/payroll/${entryId}`);
}
