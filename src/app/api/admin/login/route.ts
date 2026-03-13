import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
} from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const required = process.env.ADMIN_PASSWORD;
  if (!required) {
    return NextResponse.json(
      { ok: false, error: "Server misconfiguration: ADMIN_PASSWORD not set" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const provided = typeof body?.password === "string" ? body.password : "";

  if (!provided || provided !== required) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  const token = createAdminSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });

  return res;
}
