import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center">
      <p className="text-sm font-medium text-slate-500">404</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-800">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-sm text-slate-600">
        삭제되었거나, 권한이 없거나, 잘못된 주소일 수 있습니다.
      </p>
      <Link
        href="/"
        className="mt-5 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
      >
        대시보드로 돌아가기
      </Link>
    </div>
  );
}
