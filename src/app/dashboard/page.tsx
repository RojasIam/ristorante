import { createClient } from "@/lib/supabase/server";
import { FaUsers, FaClipboardList, FaCalendarCheck } from "react-icons/fa";
import ReservationChartsWrapper from "@/components/dashboard/ReservationChartsWrapper";

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];
  const startOfYearDate = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

  // --- PARALLEL DATA FETCHING ---
  const [
    shiftsResponse,
    reservationsResponse,
    historicalReservationsResponse
  ] = await Promise.all([
    // 1. Employee Shifts (Today, Working)
    supabase.from('employee_shifts')
      .select(`
        *,
        profile:profiles(
            first_name,
            last_name,
            global_role,
            assigned_area:areas(name)
        )
      `)
      .eq('shift_date', today)
      .eq('status', 'working'),

    // 2. Reservations (Today)
    supabase.from('daily_reservations')
      .select('cover_count, service_type')
      .eq('reservation_date', today),

    // 3. Historical Reservations (Current Year)
    supabase.from('daily_reservations')
      .select('reservation_date, cover_count, service_type')
      .gte('reservation_date', startOfYearDate)
      .order('reservation_date', { ascending: true })
  ]);

  // --- DATA PROCESSING ---
  
  // 1. Shifts
  type Shift = {
    id: string;
    shift_date: string;
    status: string;
    shift_type: 'P' | 'C';
    profile: {
      first_name: string;
      last_name: string;
      global_role: string;
      assigned_area: { name: string } | null;
    } | null;
  };
  const shifts: Shift[] = shiftsResponse.data || [];
  
  // Separate Kitchen and Hall staff
  const kitchenStaff = shifts.filter((s) => 
    ['head_chef', 'cuoco', 'admin', 'super_admin'].includes(s.profile?.global_role || '')
  );
  const hallStaff = shifts.filter((s) => 
    ['maitre', 'cameriere'].includes(s.profile?.global_role || '')
  );

  const kitchenStaffCount = kitchenStaff.length;
  const hallStaffCount = hallStaff.length;

  // 2. Reservations (Cards)
  type Reservation = {
    cover_count: number;
    service_type: 'P' | 'C';
  };
  const reservations: Reservation[] = reservationsResponse.data || [];
  const lunchCovers = reservations.find(r => r.service_type === 'P')?.cover_count || 0;
  const dinnerCovers = reservations.find(r => r.service_type === 'C')?.cover_count || 0;

  // 3. Historical Reservations (Chart)
  const historicalData = historicalReservationsResponse.data || [];


  // --- STATS CONFIGURATION ---
  const stats = [
    { 
        title: "Personale Cucina", 
        value: kitchenStaffCount.toString(), 
        sub: `${kitchenStaffCount} in servizio ora`, 
        icon: FaUsers, 
        color: "text-brand-500", 
        bg: "bg-brand-50" 
    },
    { 
        title: "Personale Sala", 
        value: hallStaffCount.toString(), 
        sub: `${hallStaffCount} in servizio ora`, 
        icon: FaUsers, 
        color: "text-brand-500", 
        bg: "bg-brand-50" 
    },
    { 
        title: "Prenotazioni Pranzo", 
        value: lunchCovers.toString(), 
        sub: "Coperti previsti pranzo", 
        icon: FaCalendarCheck, 
        color: "text-brand-500", 
        bg: "bg-brand-50",
        badge: "PRANZO"
    },
    { 
        title: "Prenotazioni Cena", 
        value: dinnerCovers.toString(), 
        sub: "Coperti previsti cena", 
        icon: FaCalendarCheck, 
        color: "text-brand-500", 
        bg: "bg-brand-50",
        badge: "CENA"
    },
  ];


  const getRoleAvatar = (role: string) => {
    switch (role) {
        case 'super_admin':
        case 'admin':
            return "/placeholder-administrador.png";
        case 'head_chef':
        case 'cuoco':
            return "/placeholder-cocina.png";
        case 'maitre':
        case 'cameriere':
            return "/placeholder-sala.png";
        default:
            return "/placeholder-ti.png";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Welcome Section - Keeping only date info */}
      <div className="text-center">
        <span className="inline-flex items-center text-xs font-medium bg-gray-50 dark:bg-gray-800 px-4 py-1.5 rounded-lg text-gray-500 border border-gray-200/60 dark:border-gray-700 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse mr-2.5"></span>
            {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, index) => {
            const Icon = stat.icon;
            
            return (
                <div 
                    key={index} 
                    className="group relative overflow-hidden bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                    {/* Decorative Background Gradient */}
                    <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500 bg-brand-500"></div>
                    
                    <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                {stat.title}
                            </span>
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                                    {stat.value}
                                </h3>
                                {stat.badge && (
                                    <span className="text-[10px] font-bold text-brand-500 bg-brand-500/10 px-1.5 py-0.5 rounded">
                                        {stat.badge}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className={`shrink-0 h-12 w-12 rounded-xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${stat.bg} dark:bg-opacity-20`}>
                            <Icon className={`h-6 w-6 ${stat.color}`} />
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700/50 flex items-center justify-between">
                        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate max-w-[80%]" title={stat.sub}>
                            {stat.sub}
                        </p>
                        
                        {/* Status Pulse */}
                        <div className="flex items-center gap-1.5">
                            <span className={`relative flex h-2 w-2`}>
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${stat.value !== "0" ? 'bg-brand-400' : 'bg-gray-400'}`}></span>
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${stat.value !== "0" ? 'bg-brand-500' : 'bg-gray-300'}`}></span>
                            </span>
                        </div>
                    </div>
                </div>
            )
        })}
      </div>

      {/* Main Content Area - Split into Kitchen and Hall */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Kitchen Shifts */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 flex flex-col h-full">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                <div className="shrink-0 h-8 w-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                    <FaClipboardList className="h-4 w-4 text-brand-500" />
                </div>
                Turni Cucina
            </h3>
            
            <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2 flex-1">
                {kitchenStaff.length > 0 ? (
                    kitchenStaff.map((shift) => (
                        <div key={shift.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100/50 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-700 shadow-xs hover:shadow-md transition-all duration-300">
                            <div className="flex items-center gap-4">
                                <div className="h-11 w-11 rounded-full overflow-hidden relative border-2 border-white dark:border-gray-600 shadow-sm">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img 
                                        src={getRoleAvatar(shift.profile?.global_role || '')}
                                        alt={shift.profile?.first_name || 'User'}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                                        {shift.profile?.first_name} {shift.profile?.last_name}
                                    </p>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
                                        {shift.profile?.assigned_area?.name || 'Cucina'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                                <span className="text-[10px] font-medium text-gray-400">
                                    {shift.shift_type === 'P' ? 'Pranzo' : 'Cena'}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-50 dark:border-gray-800 rounded-2xl">
                         <FaUsers size={32} className="opacity-10 mb-4" />
                         <p className="text-sm font-medium">Nessun cuoco in turno.</p>
                    </div>
                )}
            </div>
        </div>

        {/* Hall Shifts */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 flex flex-col h-full">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                <div className="shrink-0 h-8 w-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                    <FaClipboardList className="h-4 w-4 text-brand-500" />
                </div>
                Turni Sala
            </h3>
            
            <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2 flex-1">
                {hallStaff.length > 0 ? (
                    hallStaff.map((shift) => (
                        <div key={shift.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100/50 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-700 shadow-xs hover:shadow-md transition-all duration-300">
                            <div className="flex items-center gap-4">
                                <div className="h-11 w-11 rounded-full overflow-hidden relative border-2 border-white dark:border-gray-600 shadow-sm">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img 
                                        src={getRoleAvatar(shift.profile?.global_role || '')}
                                        alt={shift.profile?.first_name || 'User'}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                                        {shift.profile?.first_name} {shift.profile?.last_name}
                                    </p>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
                                        {shift.profile?.assigned_area?.name || 'Sala'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                                <span className="text-[10px] font-medium text-gray-400">
                                    {shift.shift_type === 'P' ? 'Pranzo' : 'Cena'}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-50 dark:border-gray-800 rounded-2xl">
                         <FaUsers size={32} className="opacity-10 mb-4" />
                         <p className="text-sm font-medium">Nessun cameriere in turno.</p>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Reservation Analysis - Trends and Daily Detail */}
      <ReservationChartsWrapper data={historicalData} />
    </div>
  );
}
