// 간단한 마크다운 → JSX (외부 라이브러리 안 씀).
// 지원: # ## ### 제목 / **bold** / - 리스트 / 1. 번호리스트 / 빈 줄 / 표는 그대로 표시.

import { Fragment } from "react";

export function MarkdownView({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuf: { ordered: boolean; items: string[] } | null = null;
  let tableBuf: string[][] | null = null;

  function flushList() {
    if (!listBuf) return;
    const Tag = listBuf.ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={blocks.length}
        className={`${listBuf.ordered ? "list-decimal" : "list-disc"} my-2 pl-6 leading-relaxed`}
      >
        {listBuf.items.map((it, i) => (
          <li key={i}>{renderInline(it)}</li>
        ))}
      </Tag>,
    );
    listBuf = null;
  }

  function flushTable() {
    if (!tableBuf || tableBuf.length === 0) return;
    const [head, ...rest] = tableBuf;
    const body = rest.filter((r) => !r.every((c) => /^[-\s|:]+$/.test(c)));
    blocks.push(
      <div key={blocks.length} className="my-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              {head.map((c, i) => (
                <th key={i} className="border border-slate-300 px-2 py-1 text-left font-semibold">
                  {renderInline(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} className="border-b border-slate-100">
                {row.map((c, ci) => (
                  <td key={ci} className="border border-slate-200 px-2 py-1">
                    {renderInline(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    tableBuf = null;
  }

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");

    // 표 (| col | col |)
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line.slice(1, -1).split("|").map((s) => s.trim());
      if (!tableBuf) tableBuf = [];
      tableBuf.push(cells);
      flushList();
      continue;
    } else {
      flushTable();
    }

    // 헤더
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushList();
      const level = h[1].length;
      const cls = ["mt-5 text-2xl font-bold", "mt-4 text-xl font-bold", "mt-3 text-base font-bold", "mt-2 text-sm font-semibold"][level - 1];
      const T = (`h${level}` as unknown) as keyof JSX.IntrinsicElements;
      blocks.push(<T key={blocks.length} className={cls}>{renderInline(h[2])}</T>);
      continue;
    }

    // 리스트
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (ul) {
      if (!listBuf || listBuf.ordered) {
        flushList();
        listBuf = { ordered: false, items: [] };
      }
      listBuf.items.push(ul[1]);
      continue;
    }
    if (ol) {
      if (!listBuf || !listBuf.ordered) {
        flushList();
        listBuf = { ordered: true, items: [] };
      }
      listBuf.items.push(ol[2]);
      continue;
    }

    flushList();

    // 빈 줄
    if (line.trim() === "") {
      blocks.push(<div key={blocks.length} className="h-2" />);
      continue;
    }

    // 일반 단락
    blocks.push(
      <p key={blocks.length} className="leading-relaxed">
        {renderInline(line)}
      </p>,
    );
  }
  flushList();
  flushTable();

  return <div className="text-slate-800">{blocks}</div>;
}

/** **bold** 등 인라인 처리 */
function renderInline(text: string): React.ReactNode {
  // **bold** → <strong>
  const parts: React.ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <strong key={parts.length} className="font-bold text-slate-900">
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <Fragment>{parts}</Fragment>;
}
