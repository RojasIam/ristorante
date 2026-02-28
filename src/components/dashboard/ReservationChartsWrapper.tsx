"use client";

import dynamic from 'next/dynamic';

const ReservationTrend = dynamic(() => import("@/components/dashboard/ReservationTrend"), { ssr: false });

interface ReservationData {
    reservation_date: string;
    cover_count: number;
    service_type: string;
}

interface ReservationChartsWrapperProps {
    data: ReservationData[];
}

export default function ReservationChartsWrapper({ data }: ReservationChartsWrapperProps) {
    return (
        <div className="mt-8">
            <ReservationTrend data={data} />
        </div>
    );
}
