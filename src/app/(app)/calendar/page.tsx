import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CalendarPage(): React.ReactElement {
  return (
    <>
      <PageHeader
        title="Calendar"
        description="See scheduled posts at a glance."
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming in M5</CardTitle>
          <CardDescription>
            Month and week views of every scheduled and published platform
            post.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}
