"use client";

import React, { useState, useMemo } from 'react';
import { 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    Area, 
    AreaChart 
} from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns';
import { it } from 'date-fns/locale';

interface ReservationData {
    reservation_date: string;
    cover_count: number;
    service_type: string;
}

interface ReservationTrendProps {
    data: ReservationData[];
}

export default function ReservationTrend({ data }: ReservationTrendProps) {
    const [view, setView] = useState<'monthly' | 'annual'>('annual');
    const [serviceFilter, setServiceFilter] = useState<'total' | 'pranzo' | 'cena'>('total');

    const chartData = useMemo(() => {
        const now = new Date();
        
        if (view === 'monthly') {
            const start = startOfMonth(now);
            const end = endOfMonth(now);
            const days = eachDayOfInterval({ start, end });
            
            return days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const filteredData = data.filter(r => r.reservation_date === dateStr);
                
                let count = 0;
                if (serviceFilter === 'total') {
                    count = filteredData.reduce((acc, curr) => acc + (curr.cover_count || 0), 0);
                } else if (serviceFilter === 'pranzo') {
                    count = filteredData
                        .filter(r => r.service_type === 'P' || r.service_type === 'pranzo')
                        .reduce((acc, curr) => acc + (curr.cover_count || 0), 0);
                } else {
                    count = filteredData
                        .filter(r => r.service_type === 'C' || r.service_type === 'cena')
                        .reduce((acc, curr) => acc + (curr.cover_count || 0), 0);
                }
                
                return {
                    label: format(day, 'd'),
                    fullDate: format(day, 'd MMM', { locale: it }),
                    Value: count
                };
            });
        }

        // Logic for Annual: Group by Month for the entire current year
        const yearStart = startOfYear(now);
        const yearEnd = endOfYear(now);
        const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

        return months.map(month => {
            const monthStr = format(month, 'yyyy-MM');
            const filteredData = data.filter(r => r.reservation_date.startsWith(monthStr));
            
            let count = 0;
            if (serviceFilter === 'total') {
                count = filteredData.reduce((acc, curr) => acc + (curr.cover_count || 0), 0);
            } else if (serviceFilter === 'pranzo') {
                count = filteredData
                    .filter(r => r.service_type === 'P' || r.service_type === 'pranzo')
                    .reduce((acc, curr) => acc + (curr.cover_count || 0), 0);
            } else {
                count = filteredData
                    .filter(r => r.service_type === 'C' || r.service_type === 'cena')
                    .reduce((acc, curr) => acc + (curr.cover_count || 0), 0);
            }
            
            return {
                label: format(month, 'MMM', { locale: it }),
                fullMonth: format(month, 'MMMM', { locale: it }),
                Value: count
            };
        });
    }, [data, view, serviceFilter]);

    const now = new Date();

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 overflow-hidden flex flex-col w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-700 mb-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-6">
                <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white uppercase tracking-tight">Trend Prenotazioni</h3>
                    <p className="text-xs text-gray-400 font-medium mt-1">
                        Analisi {serviceFilter === 'total' ? 'totale' : serviceFilter} {(view === 'annual') ? 'mensile' : 'giornaliera'} {now.getFullYear()}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* View Toggle - Keeping it neutral */}
                    <div className="flex bg-gray-50 dark:bg-gray-900/40 p-1 rounded-xl border border-gray-100 dark:border-gray-700/50">
                        <button
                            onClick={() => setView('monthly')}
                            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-300 ${
                                view === 'monthly'
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-100 dark:ring-gray-700'
                                    : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            Mensile
                        </button>
                        <button
                            onClick={() => setView('annual')}
                            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-300 ${
                                view === 'annual'
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-100 dark:ring-gray-700'
                                    : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            Annuale
                        </button>
                    </div>

                    {/* Service Toggle - Playing with two brand colors */}
                    <div className="flex bg-gray-50 dark:bg-gray-900/40 p-1 rounded-xl border border-gray-100 dark:border-gray-700/50">
                        <button
                            onClick={() => setServiceFilter('total')}
                            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-300 ${
                                serviceFilter === 'total'
                                    ? 'bg-gray-900 text-white shadow-lg shadow-gray-200 dark:shadow-none'
                                    : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            Tutti
                        </button>
                        <button
                            onClick={() => setServiceFilter('pranzo')}
                            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-300 ${
                                serviceFilter === 'pranzo'
                                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                                    : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            Pranzo
                        </button>
                        <button
                            onClick={() => setServiceFilter('cena')}
                            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-300 ${
                                serviceFilter === 'cena'
                                    ? 'bg-[#034d63] text-white shadow-lg shadow-[#034d63]/20'
                                    : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            Cena
                        </button>
                    </div>
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={
                                    serviceFilter === 'pranzo' ? '#0297c2' : 
                                    serviceFilter === 'cena' ? '#034d63' : '#0297c2'
                                } stopOpacity={0.15}/>
                                <stop offset="95%" stopColor={
                                    serviceFilter === 'pranzo' ? '#0297c2' : 
                                    serviceFilter === 'cena' ? '#034d63' : '#0297c2'
                                } stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis 
                            dataKey="label" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                            interval={view === 'monthly' ? 2 : 0}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                        />
                        <Tooltip 
                            contentStyle={{ 
                                borderRadius: '16px', 
                                border: 'none',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                padding: '12px'
                            }}
                            labelFormatter={(label, items) => {
                                if (view === 'monthly' && items[0]) {
                                    return items[0].payload.fullDate;
                                }
                                if (view === 'annual' && items[0]) {
                                    return items[0].payload.fullMonth;
                                }
                                return label;
                            }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="Value" 
                            name="Coperti"
                            stroke={
                                serviceFilter === 'pranzo' ? '#0297c2' : 
                                serviceFilter === 'cena' ? '#034d63' : '#0297c2'
                            } 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorTrend)" 
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
