"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700"
    >
      🖨 인쇄 / PDF 저장
    </button>
  );
}
