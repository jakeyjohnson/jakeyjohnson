import { getWorkspace } from "@/lib/workspace";
import { BrandingForm } from "@/components/BrandingForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const workspace = await getWorkspace();
  return <BrandingForm branding={workspace.branding} />;
}
