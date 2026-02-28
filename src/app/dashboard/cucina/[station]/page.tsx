import React from "react";
import { StationTabs } from "@/components/cucina/StationTabs";

// Dynamic page component
export default async function StationPage({
  params,
}: {
  params: Promise<{ station: string }>;
}) {
  const { station } = await params;
  
  // Capitalize station name for display
  const stationName = station.charAt(0).toUpperCase() + station.slice(1);

  return (
    <div className="space-y-6 flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-1 shrink-0 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Gestione: <span className="text-brand-500">{stationName}</span>
        </h1>
      </div>

      {/* Main Content: Tabs for Dishes / Inventory */}
      <div className="w-full">
        <StationTabs station={station} />
      </div>
    </div>
  );
}
