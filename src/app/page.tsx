import { redirect } from "next/navigation";
import { isPasswordSet, readSessionFromCookie } from "@/lib/auth";

export default async function RootPage(): Promise<never> {
  if (!(await isPasswordSet())) redirect("/setup");
  if (!(await readSessionFromCookie())) redirect("/login");
  redirect("/dashboard");
}
