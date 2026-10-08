import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadAdminActor } from "@/lib/requireAdmin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/admin")}`);
  }

  const admin = await loadAdminActor();
  if (!admin) {
    notFound();
  }

  return <>{children}</>;
}
