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
import { format, eachDayOfInterval, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { FaCalendarAlt } from 'react-icons/fa';

interface ReservationData {
    reservation_date: string;
    cover_count: number;
    service_type: string;
}

interface DailyAnalysisChartProps {
    data: ReservationData[];
}

export default function DailyAnalysisChart({ data }: DailyAnalysisChartProps) {
    // Default range is current week
    const [startDate, setStartDate] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));

    const chartData = useMemo(() => {
        try {
            const start = parseISO(startDate);
            const end = parseISO(endDate);
            
            if (start > end) return [];

            const days = eachDayOfInterval({ start, end });
            
            return days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const lunch = data
                    .filter(r => r.reservation_date === dateStr && (r.service_type === 'P' || r.service_type === 'pranzo'))
                    .reduce((acc, curr) => acc + (curr.cover_count || 0), 0);
                const dinner = data
                    .filter(r => r.reservation_date === dateStr && (r.service_type === 'C' || r.service_type === 'cena'))
                    .reduce((acc, curr) => acc + (curr.cover_count || 0), 0);
                
                return {
                    label: format(day, 'EEE d', { locale: it }),
                    Pranzo: lunch,
                    Cena: dinner,
                    Total: lunch + dinner
                };
            });
        } catch {
            return [];
        }
    }, [data, startDate, endDate]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 overflow-hidden flex flex-col w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-6">
                <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white uppercase tracking-tight">Dettaglio Giornaliero</h3>
                    <p className="text-xs text-gray-400 font-medium mt-1">Analisi dei coperti per servicio (Pranzo/Cena)</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-gray-900/40 p-2 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-xl shadow-xs border border-gray-100 dark:border-gray-700">
                        <FaCalendarAlt className="text-brand-500 w-3 h-3" />
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="text-[11px] font-bold bg-transparent border-none focus:ring-0 text-gray-600 dark:text-gray-300 p-0"
                        />
                    </div>
                    <span className="text-gray-400 font-bold text-xs">al</span>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-xl shadow-xs border border-gray-100 dark:border-gray-700">
                        <FaCalendarAlt className="text-brand-500 w-3 h-3" />
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="text-[11px] font-bold bg-transparent border-none focus:ring-0 text-gray-600 dark:text-gray-300 p-0"
                        />
                    </div>
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorPranzo" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0297c2" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#0297c2" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorCena" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#034d63" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#034d63" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f2f2f2" />
                        <XAxis 
                            dataKey="label" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fontWeight: 600, fill: '#94a3b8' }}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fontWeight: 600, fill: '#94a3b8' }}
                        />
                        <Tooltip 
                            contentStyle={{ 
                                borderRadius: '12px', 
                                border: '1px solid #f1f5f9', 
                                fontSize: '11px',
                                fontWeight: 'bold'
                            }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="Pranzo" 
                            stroke="#0297c2" 
                            strokeWidth={2.5}
                            fillOpacity={1} 
                            fill="url(#colorPranzo)" 
                            stackId="1"
                            animationDuration={1000}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="Cena" 
                            stroke="#034d63" 
                            strokeWidth={2.5}
                            fillOpacity={1} 
                            fill="url(#colorCena)" 
                            stackId="1"
                            animationDuration={1000}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center gap-8 mt-6 pt-4 border-t border-gray-50 dark:border-gray-700/50">
                <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand-500 shadow-sm shadow-brand-500/20"></div>
                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Pranzo</span>
                </div>
                <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#034d63] shadow-sm shadow-[#034d63]/20"></div>
                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Cena</span>
                </div>
            </div>
        </div>
    );
}
