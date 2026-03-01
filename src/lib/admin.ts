export function assertAdmin(req: Request) {
  const required = process.env.ADMIN_PASSWORD;
  if (!required) {
    throw new Error("Missing ADMIN_PASSWORD");
  }

  const provided = req.headers.get("x-admin-password");
  if (!provided || provided !== required) {
    return false;
  }

  return true;
}
