#!/usr/bin/env bash
# 실연: dev 서버에 대해 세션 쿠키를 발급하고 보호된 라우트에 접근.
# - 비로그인 → /clients 접근 → 로그인 페이지로 리다이렉트
# - 세무사 세션으로 자기 사무소 고객 상세 → 200 + 부가세 집계 표시
# - 같은 세션으로 다른 사무소 고객 상세 → 403
# - 비멤버 고객사 사용자가 사무소 고객 상세 → 403

set -euo pipefail

BASE=${BASE:-http://localhost:3000}
SECRET="change-me-in-production"  # .env의 SESSION_SECRET와 동일

# 세션 쿠키 발급 (HMAC-SHA256 서명, base64url payload)
mint_cookie() {
  local payload="$1"
  local b64
  b64=$(printf '%s' "$payload" | base64 | tr '+/' '-_' | tr -d '=' | tr -d '\n')
  local sig
  sig=$(printf '%s' "$b64" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')
  printf 'demo_session=%s.%s' "$b64" "$sig"
}

NODE_DB_QUERY='node -e "
  const { PrismaClient } = require(\"@prisma/client\");
  (async () => {
    const db = new PrismaClient();
    const result = await ($1);
    console.log(JSON.stringify(result));
    await db.\$disconnect();
  })().catch(e => { console.error(e); process.exit(1); });
"'

ACC_USER=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  (async () => {
    const db = new PrismaClient();
    const u = await db.user.findFirst({ where: { email: 'accountant@example.com' } });
    console.log(JSON.stringify(u));
    await db.\$disconnect();
  })();
")
OWNER_USER=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  (async () => {
    const db = new PrismaClient();
    const u = await db.user.findFirst({ where: { email: 'owner@sample.co.kr' } });
    console.log(JSON.stringify(u));
    await db.\$disconnect();
  })();
")
CLIENT_A=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  (async () => {
    const db = new PrismaClient();
    const c = await db.client.findFirst({ where: { bizNo: '111-22-33333' } });
    console.log(c.id);
    await db.\$disconnect();
  })();
")
CLIENT_B=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  (async () => {
    const db = new PrismaClient();
    const c = await db.client.findFirst({ where: { bizNo: '999-99-99999' } });
    console.log(c?.id || '');
    await db.\$disconnect();
  })();
")

ACC_ID=$(echo "$ACC_USER" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>console.log(JSON.parse(s).id))")
ACC_FIRM=$(echo "$ACC_USER" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>console.log(JSON.parse(s).firmId))")
OWNER_ID=$(echo "$OWNER_USER" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>console.log(JSON.parse(s).id))")

ACC_PAYLOAD=$(printf '{"userId":"%s","email":"accountant@example.com","role":"ACCOUNTANT","firmId":"%s","activeClientId":"%s"}' "$ACC_ID" "$ACC_FIRM" "$CLIENT_A")
OWNER_PAYLOAD=$(printf '{"userId":"%s","email":"owner@sample.co.kr","role":"CLIENT","firmId":null,"activeClientId":"%s"}' "$OWNER_ID" "$CLIENT_A")

ACC_COOKIE=$(mint_cookie "$ACC_PAYLOAD")
OWNER_COOKIE=$(mint_cookie "$OWNER_PAYLOAD")

bar() { printf '%.0s─' {1..60}; echo; }

probe() {
  local label="$1" cookie="$2" path="$3"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --cookie "$cookie" "${BASE}${path}")
  printf "  %-50s %s\n" "$label" "→ HTTP $code"
}

bar
echo "실연: dev 서버 라우트 접근 테스트"
bar

echo ""
echo "[비로그인]"
probe "GET /clients (보호됨)" "" "/clients"

echo ""
echo "[세무사 세션]"
probe "GET / (홈)" "$ACC_COOKIE" "/"
probe "GET /clients" "$ACC_COOKIE" "/clients"
probe "GET /clients/$CLIENT_A (자기 사무소)" "$ACC_COOKIE" "/clients/$CLIENT_A"
if [ -n "$CLIENT_B" ]; then
  probe "GET /clients/$CLIENT_B (타사무소 - 차단되어야 함)" "$ACC_COOKIE" "/clients/$CLIENT_B"
fi

echo ""
echo "[고객사 사용자 세션]"
probe "GET /clients/$CLIENT_A (자기 회사)" "$OWNER_COOKIE" "/clients/$CLIENT_A"
if [ -n "$CLIENT_B" ]; then
  probe "GET /clients/$CLIENT_B (멤버 아님 - 차단되어야 함)" "$OWNER_COOKIE" "/clients/$CLIENT_B"
fi

echo ""
echo "[세무사 세션 - 고객사 상세에서 부가세 자동 집계 확인]"
TMP=$(mktemp)
curl -s --cookie "$ACC_COOKIE" "${BASE}/clients/$CLIENT_A?year=2025" -o "$TMP"
echo "  HTML 응답에서 추출한 집계값(2025년):"
grep -oE '(매출 공급가액|매출세액|매입 공급가액|매입세액|납부세액|환급세액)[^"]{0,80}원' "$TMP" \
  | sed -E 's/<!--[^>]*>//g; s/<[^>]+>/ /g; s/  +/ /g' \
  | sed 's/^/    /' || true
echo ""
echo "  HTML에서 추출한 분개 라인(차변/대변):"
grep -oE '"children":\[(\\?"[가-힣A-Za-z]+\\?"|"[가-힣A-Za-z]+"),[^]]*"[가-힣]변"[^]]*"[0-9,]+원"\]' "$TMP" \
  | head -10 \
  | sed 's/^/    /' || true
rm -f "$TMP"

echo ""
bar
