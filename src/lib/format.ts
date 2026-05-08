// 서버·클라이언트 모두에서 안전하게 import 가능한 순수 포맷터.
// (이전: MoneyInput.tsx에 함께 두었더니 "use client" 파일에서 export된 함수가
//  서버 컴포넌트에서 호출 시 런타임 에러를 일으켰음.)

export function fmt(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}
