"use client";

type Option = { id: string; name: string };

export function ClientSelect({
  options,
  defaultValue,
}: {
  options: Option[];
  defaultValue?: string;
}) {
  return (
    <select
      name="clientId"
      defaultValue={defaultValue}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="rounded border border-slate-300 bg-white px-2 py-1"
    >
      {options.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
