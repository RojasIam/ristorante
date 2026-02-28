import { StaffManager } from "@/components/personale/StaffManager";

export default function PersonalePage() {
  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="shrink-0 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Registro Personale</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Visualizza e gestisci i ruoli dello staff (Executive Chef, Maître, Staff).
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <StaffManager />
      </div>
    </div>
  );
}
