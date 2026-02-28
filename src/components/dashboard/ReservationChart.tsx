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
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfYear, endOfYear, eachMonthOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';

interface ReservationData {
    reservation_date: string;
    cover_count: number;
    service_type: string;
}

interface ReservationChartProps {
    data: ReservationData[];
}

export default function ReservationChart({ data }: ReservationChartProps) {
    const [view, setView] = useState<'weekly' | 'monthly' | 'annual'>('monthly');
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const chartData = useMemo(() => {
        const now = new Date();
        
        if (view === 'weekly') {
            const start = startOfWeek(now, { weekStartsOn: 1 });
            const end = endOfWeek(now, { weekStartsOn: 1 });
            const daysInWeek = eachDayOfInterval({ start, end });
            
            return daysInWeek.map(day => {
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
        }
        
        if (view === 'monthly') {
            const start = startOfMonth(now);
            const end = endOfMonth(now);
            const daysInMonth = eachDayOfInterval({ start, end });
            
            return daysInMonth.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const lunch = data
                    .filter(r => r.reservation_date === dateStr && (r.service_type === 'P' || r.service_type === 'pranzo'))
                    .reduce((acc, curr) => acc + (curr.cover_count || 0), 0);
                const dinner = data
                    .filter(r => r.reservation_date === dateStr && (r.service_type === 'C' || r.service_type === 'cena'))
                    .reduce((acc, curr) => acc + (curr.cover_count || 0), 0);
                
                return {
                    label: format(day, 'd MMM', { locale: it }),
                    Pranzo: lunch,
                    Cena: dinner,
                    Total: lunch + dinner
                };
            });
        } else {
            const start = startOfYear(now);
            const end = endOfYear(now);
            const monthsInYear = eachMonthOfInterval({ start, end });
            
            return monthsInYear.map(month => {
                const monthStr = format(month, 'yyyy-MM');
                const total = data
                    .filter(r => r.reservation_date.startsWith(monthStr))
                    .reduce((acc, curr) => acc + (curr.cover_count || 0), 0);
                
                return {
                    label: format(month, 'MMMM', { locale: it }),
                    Total: total
                };
            });
        }
    }, [data, view]);

    if (!isMounted) {
        return (
            <div className="h-[430px] w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 animate-pulse flex items-center justify-center">
                <div className="text-gray-300 dark:text-gray-600 font-bold">Caricamento grafico...</div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 overflow-hidden flex flex-col w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white uppercase tracking-tight">Andamento Prenotazioni</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                        Analisi dettagliata coperti {(view === 'annual') ? 'mensili' : 'giornalieri'}
                    </p>
                </div>

                <div className="flex bg-gray-50 dark:bg-gray-900/50 p-1 rounded-xl border border-gray-100 dark:border-gray-700">
                    <button
                        onClick={() => setView('weekly')}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 ${
                            view === 'weekly'
                                ? 'bg-white dark:bg-gray-800 text-brand-500 shadow-sm'
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                    >
                        Settimana
                    </button>
                    <button
                        onClick={() => setView('monthly')}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 ${
                            view === 'monthly'
                                ? 'bg-white dark:bg-gray-800 text-brand-500 shadow-sm'
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                    >
                        Mese
                    </button>
                    <button
                        onClick={() => setView('annual')}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 ${
                            view === 'annual'
                                ? 'bg-white dark:bg-gray-800 text-brand-500 shadow-sm'
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                    >
                        Anno
                    </button>
                </div>
            </div>

            <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
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
                            interval={view === 'monthly' ? 2 : 0}
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
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: '#1e293b'
                            }}
                            cursor={{ stroke: '#0297c2', strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        
                        {view !== 'annual' ? (
                            <>
                                <Area 
                                    type="monotone" 
                                    dataKey="Pranzo" 
                                    stroke="#0297c2" 
                                    strokeWidth={2.5}
                                    fillOpacity={1} 
                                    fill="url(#colorTotal)" 
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
                            </>
                        ) : (
                            <Area 
                                type="monotone" 
                                dataKey="Total" 
                                name="Coperti"
                                stroke="#0297c2" 
                                strokeWidth={3}
                                fillOpacity={1} 
                                fill="url(#colorTotal)" 
                                animationDuration={1000}
                            />
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            
            {view !== 'annual' && (
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
            )}
        </div>
    );
}

