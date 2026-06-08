import { redirect } from "next/navigation";
import { isPasswordSet } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}): Promise<React.ReactElement> {
  if (!(await isPasswordSet())) {
    redirect("/setup");
  }
  const sp = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Push</CardTitle>
        <CardDescription>Local social media scheduler</CardDescription>
      </CardHeader>
      <LoginForm next={sp.next ?? "/dashboard"} />
    </Card>
  );
}
