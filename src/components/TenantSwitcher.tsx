"use client";

import { useEffect, useState } from "react";
import { getActiveTenant, setActiveTenant, type Tenant, listTenants } from "@/lib/tenant/client";

export function TenantSwitcher() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [active, setActive] = useState<Tenant | null>(null);

  useEffect(() => {
    setTenants(listTenants());
    setActive(getActiveTenant());
  }, []);

  if (!active) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">현재:</span>
      <select
        value={active.id}
        onChange={(e) => {
          const next = tenants.find((t) => t.id === e.target.value);
          if (next) {
            setActiveTenant(next);
            setActive(next);
            window.location.reload();
          }
        }}
        className="rounded border border-slate-300 bg-white px-2 py-1"
      >
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            [{t.role === "ACCOUNTANT" ? "세무사" : "고객사"}] {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
