import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GeneralSettingsPage(): React.ReactElement {
  return (
    <>
      <PageHeader
        title="General"
        description="Runtime behavior and operator preferences."
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            Watch folder toggle, approval requirement, processed-file
            disposition, and other preferences land alongside their
            corresponding milestones.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}
