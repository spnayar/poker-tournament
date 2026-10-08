import { BrandLockup } from "@/components/BrandMark";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <BrandLockup href="/dashboard" />
      <h1 className="mt-8 text-xl font-semibold">Page not found</h1>
      <p className="text-slate-400 text-sm mt-2">That page does not exist.</p>
    </div>
  );
}
