import NextAuth from "next-auth";
import { authOptions, readAuthSecret } from "@/lib/auth";

function handler(req: Request, context: unknown) {
  return NextAuth({
    ...authOptions,
    secret: readAuthSecret(),
  })(req, context);
}

export { handler as GET, handler as POST };
