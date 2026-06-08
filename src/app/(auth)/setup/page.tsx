import { redirect } from "next/navigation";
import { isPasswordSet } from "@/lib/auth";
import { SetupForm } from "./setup-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SetupPage(): Promise<React.ReactElement> {
  if (await isPasswordSet()) {
    redirect("/login");
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome to Push</CardTitle>
        <CardDescription>
          Set a password for this workstation. You'll use it every time you open
          Push in your browser.
        </CardDescription>
      </CardHeader>
      <SetupForm />
    </Card>
  );
}
