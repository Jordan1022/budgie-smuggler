import { ImportUploadForm } from "@/components/import/import-upload-form";
import { requireUser } from "@/lib/auth";
import { getAccounts } from "@/lib/server-data";

export default async function ImportPage() {
  const user = await requireUser();
  const data = await getAccounts(user.id);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Import</h1>
        <p className="text-sm text-neutral-600">Upload CSV statements while Plaid is unavailable.</p>
      </header>

      <ImportUploadForm initialAccounts={data.accounts} source={data.source} />
    </div>
  );
}
