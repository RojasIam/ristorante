"use client";

import React, { useState, useEffect } from "react";
import { FaChevronLeft, FaChevronRight, FaCalendarAlt, FaDownload } from "react-icons/fa";
import { toPng } from 'html-to-image';

import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";

// --- Types ---
type ShiftType = 'P' | 'C'; // Pranzo, Cena
type ShiftStatus = 'working' | 'off' | 'empty';

interface SimpleDate {
  day: number;
  month: number;
  year: number;
  dayName: string; // 'lun', 'mar', etc.
  fullDate: Date;
}

interface UserShift {
  userId: string;
  dateStr: string; // YYYY-MM-DD
  type: ShiftType;
  status: ShiftStatus;
}

interface Reservation {
    dateStr: string;
    type: ShiftType;
    count: number;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface ProfileRaw {
  id: string;
  first_name: string | null;
  last_name: string | null;
  global_role: string;
  email?: string;
}

interface ReservationRaw {
    reservation_date: string;
    service_type: string;
    cover_count: number;
}

// --- Helpers ---
const getWeekDays = (startDate: Date): SimpleDate[] => {
  const days: SimpleDate[] = [];
  // Ensure we start from Monday
  const day = startDate.getDay();
  const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(startDate.setDate(diff));

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      day: d.getDate(),
      month: d.getMonth(),
      year: d.getFullYear(),
      dayName: d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', ''),
      fullDate: d
    });
  }
  return days;
};

const formatDateKey = (date: Date) => {
  return date.toISOString().split('T')[0];
};

export default function OrarioPage() {
  const { user, hasPermission } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekDays, setWeekDays] = useState<SimpleDate[]>([]);
  const [shifts, setShifts] = useState<UserShift[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const supabase = createClient();

  // Fetch Staff on Mount
  useEffect(() => {
    const fetchStaff = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, global_role')
            .not('global_role', 'in', '("admin","super_admin")') // Filter out admins
            .order('first_name');
        
        console.log("Fetching staff result:", { data, error });
        if (error) {
            console.error("Error fetching staff:", error);
            return;
        }

            if (data) {
                // Filter Kitchen Roles Client-Side for reliability
                const kitchenRoles = ['head_chef', 'chef', 'cuoco', 'pizzaiolo', 'lavapiatti', 'aiuto_cuoco'];
                
                // Assert type for profile data
                const profiles = data as unknown as ProfileRaw[];

                const mappedStaff = profiles
                    .filter((p) => kitchenRoles.includes(p.global_role))
                    .map((p) => ({
                        id: p.id,
                        name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || 'Unnamed',
                        role: p.global_role
                    }));
                
                console.log("Filtered Kitchen Staff:", mappedStaff);
                setStaff(mappedStaff);
            }
        };
        fetchStaff();
    }, [supabase]);

  useEffect(() => {
    // 1. Calculate Week Days
    const days = getWeekDays(new Date(currentDate)); 
    setWeekDays(days);
    
    // 2. Fetch Shifts for this range
    const fetchShifts = async () => {
        if (days.length === 0) return;
        
        const startDate = formatDateKey(days[0].fullDate);
        const endDate = formatDateKey(days[6].fullDate);

        const { data, error } = await supabase
            .from('employee_shifts')
            .select('user_id, shift_date, shift_type, status')
            .gte('shift_date', startDate)
            .lte('shift_date', endDate);

        if (error) {
            console.error("Error fetching shifts:", error);
        } else if (data) {
            // Fix 'any' by being explicit or trusting the shape if it matches
            const loadedShifts: UserShift[] = data.map((d: { user_id: string; shift_date: string; shift_type: string; status: string }) => ({
                userId: d.user_id,
                dateStr: d.shift_date,
                type: d.shift_type as ShiftType,
                status: d.status as ShiftStatus
            }));
            setShifts(loadedShifts);
        } else {
            setShifts([]);
        }

        // Fetch Reservations
        const { data: resData, error: resError } = await supabase
            .from('daily_reservations')
            .select('reservation_date, service_type, cover_count')
            .gte('reservation_date', startDate)
            .lte('reservation_date', endDate);
            
        if (resError) {
             console.error("Error fetching reservations:", resError);
        } else if (resData) {
            // Use unknown -> type assertion for safety
            const rawReservations = resData as unknown as ReservationRaw[];
            
            const loadedRes: Reservation[] = rawReservations.map((r) => ({
                dateStr: r.reservation_date,
                type: r.service_type as ShiftType,
                count: r.cover_count
            }));
            setReservations(loadedRes);
        } else {
            setReservations([]);
        }
    };

    fetchShifts();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, staff]); // Add staff dependency to re-fetch if staff loads late, suppress supabase warning

  // Navigate Weeks
  const nextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + 7);
    setCurrentDate(next);
  };

  const prevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(currentDate.getDate() - 7);
    setCurrentDate(prev);
  };

  // Handle Cell Click (Toggle)
  const toggleShift = async (userId: string, dateStr: string, type: ShiftType) => {
      // 1. Check Global Authority (Only Kitchen/Admins here)
      const canEditAnySchedule = hasPermission.canManageSystem();
      const isChef = user?.global_role === 'head_chef';
      
      if (!canEditAnySchedule && !isChef) {
          console.warn("Permission denied: You are not a Chef or Admin.");
          return;
      }

      // 2. Check Week Date Restriction
      if (!hasPermission.canEditSchedule(new Date(dateStr))) {
          console.warn("Permission denied: Cannot edit past schedules.");
          return;
      }

      // Find current status
      const existingShift = shifts.find(s => s.userId === userId && s.dateStr === dateStr && s.type === type);
      const currentStatus = existingShift ? existingShift.status : 'empty';
      
      // Determine next status: empty -> working -> off -> empty
      let nextStatus: ShiftStatus = 'working';
      if (currentStatus === 'working') nextStatus = 'off';
      else if (currentStatus === 'off') nextStatus = 'empty';

      // Optimistic Update
      setShifts(prev => {
          const filtered = prev.filter(s => !(s.userId === userId && s.dateStr === dateStr && s.type === type));
          if (nextStatus === 'empty') return filtered;
          return [...filtered, { userId, dateStr, type, status: nextStatus }];
      });

      // Database Update
      try {
          if (nextStatus === 'empty') {
              // Delete record
               await supabase
                  .from('employee_shifts')
                  .delete()
                  .match({ user_id: userId, shift_date: dateStr, shift_type: type });
          } else {
              // Upsert record
              await supabase
                  .from('employee_shifts')
                  .upsert({ 
                      user_id: userId, 
                      shift_date: dateStr, 
                      shift_type: type, 
                      status: nextStatus 
                  }, { onConflict: 'user_id, shift_date, shift_type' });
          }
      } catch (error) {
          console.error("Error updating shift:", error);
          // Revert optimistic update? (For simplicity, simplified here)
      }
  };

  // Get status for rendering
  const getShiftStatus = (userId: string, dateStr: string, type: ShiftType): ShiftStatus => {
    const shift = shifts.find(s => s.userId === userId && s.dateStr === dateStr && s.type === type);
    return shift ? shift.status : 'empty';
  };

  // Count total services
  const getTotalServices = (userId: string) => {
    return shifts.filter(s => s.userId === userId && s.status === 'working').length;
  };
  
  // Get reservation count
  const getReservationCount = (dateStr: string, type: ShiftType) => {
      const res = reservations.find(r => r.dateStr === dateStr && r.type === type);
      return res ? res.count : ''; 
  }

  // Handle Reservation Input Change
  const handleReservationChange = async (dateStr: string, type: ShiftType, value: string) => {
      // 1. Permission Check
      const allowedRoles = ['super_admin', 'admin', 'head_chef', 'maitre'];
      if (!user || !allowedRoles.includes(user.global_role)) {
          console.warn("Permission denied: cannot edit reservations.");
          return;
      }

      const numValue = parseInt(value);
      if (isNaN(numValue)) return; // Allow empty string handling if strictly needed, or 0

      // Optimistic
      setReservations(prev => {
          const filtered = prev.filter(r => !(r.dateStr === dateStr && r.type === type));
          return [...filtered, { dateStr, type, count: numValue }];
      });

      // DB Upsert
      try {
          await supabase.from('daily_reservations').upsert({
              reservation_date: dateStr,
              service_type: type,
              cover_count: numValue
          }, { onConflict: 'reservation_date, service_type' });
      } catch (err) {
          console.error("Error saving reservation:", err);
      }
  };

  const getTotalReservations = () => {
      return reservations.reduce((acc, curr) => acc + (curr.count || 0), 0);
  }

  const handleExportImage = async () => {
      const element = document.getElementById('schedule-table-snapshot');
      if (!element) return;
      try {
          // 1. Force expansion via temporary style injection
          const styleId = 'snapshot-override-styles';
          let styleEl = document.getElementById(styleId);
          if (!styleEl) {
              styleEl = document.createElement('style');
              styleEl.id = styleId;
              document.head.appendChild(styleEl);
          }
          styleEl.innerHTML = `
              #schedule-table-snapshot { width: fit-content !important; }
              #schedule-table-snapshot .overflow-x-auto { overflow: visible !important; }
          `;

          // 2. Wait a tick for styles to apply? Usually immediate.
          // Capture
          const dataUrl = await toPng(element, { 
              cacheBust: true,
              style: {
                  height: 'auto',
                  maxHeight: 'none',
                  overflow: 'visible'
              }
          });
          
          // 3. Remove styles
          if (styleEl) document.head.removeChild(styleEl);

          const link = document.createElement("a");
          link.download = `orario_cucina_${formatDateKey(currentDate)}.png`;
          link.href = dataUrl;
          link.click();
      } catch (err) {
          console.error("Error exporting image:", err);
          // Cleanup if error
          const styleEl = document.getElementById('snapshot-override-styles');
          if (styleEl) document.head.removeChild(styleEl);
      }
  };

  // Render Logic
  const monthName = weekDays.length > 0 
    ? weekDays[0].fullDate.toLocaleDateString('it-IT', { month: 'long' }) 
    : '';
  const yearNum = weekDays.length > 0 ? weekDays[0].year : '';

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300 pb-10">
      
      {/* Main Container - Unified Card */}
      <div id="schedule-table-snapshot" className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        
        {/* Header & Controls Section */}
        <div className="flex flex-col items-center gap-4 p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex flex-col items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <FaCalendarAlt className="text-indigo-500" />
                    Orario Cucina
                </h1>
                <button 
                    onClick={handleExportImage}
                    title="Scarica Orario come Immagine"
                    className="p-1 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors border border-gray-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-700 flex items-center gap-2 text-xs font-medium"
                >
                    <FaDownload size={12} />
                    <span>Esporta Immagine</span>
                </button>
            </div>
            
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 p-1 rounded-lg border border-gray-200 dark:border-zinc-700">
                <button onClick={prevWeek} className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded-md shadow-sm transition-all text-gray-600 dark:text-gray-300">
                    <FaChevronLeft />
                </button>
                <div className="px-4 py-1 flex flex-col items-center min-w-[150px]">
                    <span className="text-sm font-bold capitalize text-gray-800 dark:text-gray-100">{monthName} {yearNum}</span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Settimana Corrente</span>
                </div>
                <button onClick={nextWeek} className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded-md shadow-sm transition-all text-gray-600 dark:text-gray-300">
                    <FaChevronRight />
                </button>
            </div>
        </div>

        {/* Schedule Grid */}
        <div className="overflow-x-auto pb-2">
            <table className="w-full min-w-[900px] border-collapse">
                <thead>
                    {/* Date Header */}
                    <tr className="bg-gray-50/80 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                        <th className="p-3 text-left font-semibold text-gray-600 dark:text-gray-300 w-[150px] sticky left-0 bg-gray-50 dark:bg-zinc-900 z-20 border-r border-zinc-200 dark:border-zinc-800">
                            Utente
                        </th>
                        {weekDays.map((day, idx) => (
                            <th key={idx} colSpan={2} className="py-3 px-1 text-center border-l border-zinc-200 dark:border-zinc-800 min-w-[90px]">
                                <div className="flex flex-col items-center group cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800/50 rounded p-1 transition-colors">
                                    <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wide">{day.dayName}</span>
                                    <span className="text-base font-bold text-gray-800 dark:text-gray-200 font-mono">{day.day}</span>
                                </div>
                            </th>
                        ))}
                        <th className="p-3 text-center font-semibold text-gray-600 dark:text-gray-300 border-l border-zinc-200 dark:border-zinc-800 w-[80px]">
                            Totale
                        </th>
                    </tr>
                    {/* Shift Type Sub-Header (P/C) */}
                    <tr className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase text-gray-400 tracking-wider">
                        <th className="sticky left-0 bg-white dark:bg-zinc-900 z-20 border-r border-zinc-200 dark:border-zinc-800"></th>
                        {weekDays.map((_, idx) => (
                            <React.Fragment key={idx}>
                                <th className="py-2 text-center border-l border-zinc-100 dark:border-zinc-800 font-bold w-12 hover:bg-gray-50">P</th>
                                <th className="py-2 text-center border-r border-zinc-200 dark:border-zinc-800 font-bold w-12 hover:bg-gray-50">C</th>
                            </React.Fragment>
                        ))}
                        <th className="border-l border-zinc-200 dark:border-zinc-800 bg-gray-50/30 w-[80px]"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                    {staff.map(user => (
                        <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20 transition-colors group">
                            {/* User Name Column */}
                            <td className="p-3 font-medium text-gray-800 dark:text-gray-200 sticky left-0 bg-white dark:bg-zinc-900 z-10 border-r border-zinc-200 dark:border-zinc-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] h-16 truncate max-w-[150px]" title={user.name}>
                                <div className="flex flex-col justify-center h-full">
                                    <span className="text-sm font-semibold truncate">{user.name}</span>
                                </div>
                            </td>

                            {/* Shift Cells */}
                            {weekDays.map((day, idx) => {
                                const dateKey = formatDateKey(day.fullDate);
                                const statusP = getShiftStatus(user.id, dateKey, 'P');
                                const statusC = getShiftStatus(user.id, dateKey, 'C');
                                
                                return (
                                    <React.Fragment key={idx}>
                                        {/* Pranzo Cell */}
                                        <td className="p-1 border-l border-zinc-100 dark:border-zinc-800 text-center relative h-16 min-w-[45px] cursor-pointer align-middle"
                                            onClick={() => toggleShift(user.id, dateKey, 'P')}>
                                            <div className={`w-8 h-8 rounded-md transition-all duration-200 mx-auto flex items-center justify-center border-2
                                                ${statusP === 'working' ? 'bg-green-500 border-green-500 shadow-md shadow-green-200/50 dark:shadow-none text-white' : 
                                                  statusP === 'off' ? 'bg-pink-100 border-pink-100 dark:bg-pink-900/40 dark:border-pink-900/40' : 
                                                  'bg-gray-50 border-gray-200 dark:bg-zinc-800/50 dark:border-zinc-700 hover:border-indigo-300 hover:bg-white dark:hover:bg-zinc-800'}`}
                                            >
                                                {statusP === 'off' && <span className="text-[10px] text-pink-500 font-bold">OFF</span>}
                                            </div>
                                        </td>
                                        {/* Cena Cell */}
                                        <td className="p-1 border-r border-zinc-200 dark:border-zinc-800 text-center relative h-16 min-w-[45px] cursor-pointer align-middle"
                                            onClick={() => toggleShift(user.id, dateKey, 'C')}>
                                            <div className={`w-8 h-8 rounded-md transition-all duration-200 mx-auto flex items-center justify-center border-2
                                                ${statusC === 'working' ? 'bg-green-500 border-green-500 shadow-md shadow-green-200/50 dark:shadow-none text-white' : 
                                                  statusC === 'off' ? 'bg-pink-100 border-pink-100 dark:bg-pink-900/40 dark:border-pink-900/40' : 
                                                  'bg-gray-50 border-gray-200 dark:bg-zinc-800/50 dark:border-zinc-700 hover:border-indigo-300 hover:bg-white dark:hover:bg-zinc-800'}`}
                                            >
                                                 {statusC === 'off' && <span className="text-[10px] text-pink-500 font-bold">OFF</span>}
                                            </div>
                                        </td>
                                    </React.Fragment>
                                );
                            })}

                            {/* Total Column */}
                            <td className="p-4 text-center font-bold text-gray-900 dark:text-gray-100 border-l border-zinc-200 dark:border-zinc-800 bg-gray-50/30">
                                {getTotalServices(user.id)}
                            </td>
                        </tr>
                    ))}
                    
                    {/* Reservations / Footer Row */}
                    <tr className="bg-indigo-100 dark:bg-zinc-800/80 font-medium border-t border-indigo-200 dark:border-zinc-700">
                        <td className="p-3 font-bold text-indigo-950 dark:text-indigo-100 sticky left-0 bg-indigo-100 dark:bg-zinc-900/95 z-10 border-r border-indigo-200 dark:border-zinc-700 text-sm shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            Prenotazioni
                        </td>
                         {weekDays.map((day, idx) => {
                             const dateKey = formatDateKey(day.fullDate);
                             return (
                            <React.Fragment key={idx}>
                                <td className="p-1 border-l border-indigo-200/50 dark:border-zinc-600/50 text-center">
                                    <div className="flex justify-center">
                                        <input 
                                            type="number" 
                                            value={getReservationCount(dateKey, 'P')}
                                            onChange={(e) => handleReservationChange(dateKey, 'P', e.target.value)}
                                            readOnly={!['super_admin', 'admin', 'head_chef', 'maitre'].includes(user?.global_role || '')}
                                            className="w-10 text-center bg-white/80 dark:bg-zinc-800 border border-indigo-200 dark:border-zinc-500 rounded px-1 py-1 text-xs font-mono text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-shadow hover:shadow-md" 
                                        />
                                    </div>
                                </td>
                                <td className="p-1 border-r border-indigo-200/50 dark:border-zinc-600/50 text-center">
                                    <div className="flex justify-center">
                                        <input 
                                            type="number" 
                                            value={getReservationCount(dateKey, 'C')}
                                            onChange={(e) => handleReservationChange(dateKey, 'C', e.target.value)}
                                            readOnly={!['super_admin', 'admin', 'head_chef', 'maitre'].includes(user?.global_role || '')}
                                            className="w-10 text-center bg-white/80 dark:bg-zinc-800 border border-indigo-200 dark:border-zinc-500 rounded px-1 py-1 text-xs font-mono text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-shadow hover:shadow-md" 
                                        />
                                    </div>
                                </td>
                            </React.Fragment>
                         )})}
                        <td className="p-3 text-center font-bold text-indigo-900 dark:text-white border-l border-indigo-200 dark:border-zinc-700 bg-indigo-200 dark:bg-indigo-900 text-sm">
                            {getTotalReservations()}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
