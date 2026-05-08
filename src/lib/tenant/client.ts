// 데모용 테넌트 전환기. 실서비스에서는 세션 쿠키 + 서버사이드 권한 검증으로 대체한다.
// 현재 단계: localStorage 기반 단일 사용자 시뮬레이션.

export type TenantRole = "ACCOUNTANT" | "CLIENT";

export type Tenant = {
  id: string;
  label: string;
  role: TenantRole;
  /** ACCOUNTANT는 firmId, CLIENT는 clientId 를 가리킨다. */
  scopeId: string;
};

const STORAGE_KEY = "active-tenant";

const DEMO_TENANTS: Tenant[] = [
  { id: "demo-firm", label: "데모 세무회계 사무소", role: "ACCOUNTANT", scopeId: "demo-firm" },
  { id: "demo-client-sample", label: "샘플상사", role: "CLIENT", scopeId: "demo-client-sample" },
];

export function listTenants(): Tenant[] {
  return DEMO_TENANTS;
}

export function getActiveTenant(): Tenant {
  if (typeof window === "undefined") return DEMO_TENANTS[0];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as Tenant;
    } catch {
      // fallthrough
    }
  }
  return DEMO_TENANTS[0];
}

export function setActiveTenant(t: Tenant) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}
