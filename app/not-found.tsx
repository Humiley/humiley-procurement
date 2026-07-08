import Link from "next/link";

/** Branded 404 — bilingual static text (rendered outside the intl provider). */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <p className="text-6xl font-black text-navy">404</p>
      <h1 className="text-lg font-bold text-navy">Page not found · Không tìm thấy trang</h1>
      <p className="max-w-md text-sm text-grey">
        The page you are looking for does not exist or was moved.
        <span className="block italic">Trang bạn tìm không tồn tại hoặc đã được di chuyển.</span>
      </p>
      <Link href="/dashboard" className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
        Dashboard
      </Link>
    </div>
  );
}
