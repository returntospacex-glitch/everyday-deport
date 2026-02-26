"use client";

import { useState, useEffect } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Grid2X2,
    Moon,
    Sparkles,
    Star,
    Dumbbell,
    Utensils,
    BookOpen,
    Calendar as CalendarIcon
} from "lucide-react";
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    eachDayOfInterval,
    parseISO,
    isValid
} from "date-fns";
import { ko } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { getSleepRecord, sleepRecords } from "@/lib/sleepData";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";
import { collection, onSnapshot, Timestamp } from "firebase/firestore";
import { fetchGoogleCalendarEvents, getMonthRange, CalendarEvent } from "@/lib/googleCalendar";

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const { user, googleAccessToken } = useAuth();
    const [isLoaded, setIsLoaded] = useState(false);

    const [sleepRecordsState, setSleepRecordsState] = useState<any[]>([]);
    const [exerciseRecordsState, setExerciseRecordsState] = useState<any[]>([]);
    const [mealRecordsState, setMealRecordsState] = useState<any[]>([]);
    const [readingRecordsState, setReadingRecordsState] = useState<any[]>([]);
    const [dailyRecordsState, setDailyRecordsState] = useState<any[]>([]);
    const [googleEventsState, setGoogleEventsState] = useState<CalendarEvent[]>([]);

    const monthStart = startOfMonth(currentDate);

    useEffect(() => {
        if (!user) return;
        const db = getFirebaseDb();

        // 1. Sleep Records
        const sleepUnsub = onSnapshot(collection(db, "users", user.uid, "sleep"), (snapshot) => {
            const loaded = snapshot.docs.map(doc => {
                const data = doc.data() as any;
                return {
                    ...data,
                    id: doc.id,
                    date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
                    duration: data.hoursSlept
                };
            });
            setSleepRecordsState(loaded);
        });

        // 2. Exercise Records
        const exerciseUnsub = onSnapshot(collection(db, "users", user.uid, "exercises"), (snapshot) => {
            const loaded = snapshot.docs.map(doc => {
                const data = doc.data() as any;
                return {
                    id: doc.id,
                    ...data,
                    date: data.date?.toDate ? data.date.toDate() : new Date(data.date)
                };
            });
            setExerciseRecordsState(loaded);
        });

        // 3. Meal Records
        const mealUnsub = onSnapshot(collection(db, "users", user.uid, "meals"), (snapshot) => {
            const loaded = snapshot.docs.map(doc => {
                const data = doc.data() as any;
                const dateVal = data.date;
                return {
                    id: doc.id,
                    ...data,
                    date: dateVal?.toDate ? dateVal.toDate() : new Date(dateVal)
                };
            });
            setMealRecordsState(loaded);
        });

        // 4. Reading Records
        const readingUnsub = onSnapshot(collection(db, "users", user.uid, "readingSessions"), (snapshot) => {
            const loaded = snapshot.docs.map(doc => {
                const data = doc.data() as any;
                const dateVal = data.date;
                return {
                    id: doc.id,
                    ...data,
                    date: dateVal?.toDate ? dateVal.toDate() : new Date(dateVal)
                };
            });
            setReadingRecordsState(loaded);
        });

        // 5. Daily Records (Mood)
        const dailyUnsub = onSnapshot(collection(db, "users", user.uid, "dailyRecords"), (snapshot) => {
            const loaded = snapshot.docs.map(doc => {
                const data = doc.data() as any;
                const dateVal = data.date;
                return {
                    id: doc.id,
                    ...data,
                    date: dateVal?.toDate ? dateVal.toDate() : new Date(dateVal)
                };
            });
            setDailyRecordsState(loaded);
        });

        setIsLoaded(true);

        return () => {
            sleepUnsub();
            exerciseUnsub();
            mealUnsub();
            readingUnsub();
            dailyUnsub();
        };
    }, [user]);

    // Google Calendar Events Fetch
    useEffect(() => {
        async function loadGoogleEvents() {
            if (!googleAccessToken) {
                setGoogleEventsState([]);
                return;
            }

            try {
                const { start, end } = getMonthRange(currentDate);
                const fetched = await fetchGoogleCalendarEvents(googleAccessToken, start, end);
                setGoogleEventsState(fetched);
            } catch (error) {
                console.error("Error fetching google events for month:", error);
            }
        }
        loadGoogleEvents();
    }, [googleAccessToken, currentDate]);

    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate,
    });

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-accent/20 rounded-2xl flex items-center justify-center shadow-lg shadow-accent/10">
                        <Grid2X2 className="text-accent w-6 h-6" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">캘린더</h1>
                </div>

                <div className="flex items-center gap-6 bg-white/5 px-6 py-2 rounded-2xl border border-white/10">
                    <button onClick={prevMonth} className="p-1 hover:text-accent transition-colors">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h2 className="text-xl font-bold text-white min-w-[120px] text-center">
                        {format(currentDate, 'yyyy년 M월', { locale: ko })}
                    </h2>
                    <button onClick={nextMonth} className="p-1 hover:text-accent transition-colors">
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
            </header>

            <section className="glass p-8 relative overflow-hidden">
                {/* Decoration */}
                <div className="absolute top-0 left-0 w-64 h-64 bg-accent/5 blur-[100px] -z-10" />

                <div className="grid grid-cols-7 mb-4">
                    {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                        <div key={day} className={`text-center text-sm font-bold pb-4 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-white/20'}`}>
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
                    {calendarDays.map((day, idx) => {
                        const isToday = isSameDay(day, new Date());
                        const isCurrentMonth = isSameMonth(day, monthStart);

                        return (
                            <Link
                                key={day.toISOString()}
                                href={`/calendar/${format(day, 'yyyy-MM-dd')}`}
                                className={`
                                    min-h-[135px] p-2 bg-[#0b1121] transition-all relative group cursor-pointer hover:z-20
                                    ${!isCurrentMonth ? 'opacity-20 pointer-events-none' : 'opacity-100 hover:bg-white/5'}
                                `}
                            >
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: idx * 0.01 }}
                                    className="h-full"
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`
                                            text-sm font-black w-7 h-7 flex items-center justify-center rounded-lg transition-colors
                                            ${isToday ? 'bg-accent text-white' : 'text-white/60 group-hover:text-white'}
                                        `}>
                                            {format(day, 'd')}
                                        </span>
                                        {isToday && (
                                            <Sparkles className="w-3 h-3 text-accent animate-pulse" />
                                        )}
                                    </div>

                                    <div className="mt-3 space-y-1 overflow-hidden">
                                        {/* 1. Sleep: 😴 수면기록 */}
                                        {(() => {
                                            const record = sleepRecordsState.find(r => {
                                                if (!r.date) return false;
                                                const d = r.date instanceof Date ? r.date : (r.date.toDate ? r.date.toDate() : new Date(r.date));
                                                return isSameDay(d, day);
                                            });
                                            return record ? (
                                                <div className="flex items-center gap-1.5 bg-purple-500/10 w-full px-2 py-0.5 rounded-lg border border-purple-500/20">
                                                    <Moon className="w-2.5 h-2.5 text-purple-400 fill-current" />
                                                    <span className="text-[10px] font-black text-purple-300">{(record.hoursSlept || record.duration || 0).toFixed(1)}h</span>
                                                </div>
                                            ) : <div className="h-[21px]" />; // Spacer
                                        })()}

                                        {/* 2. Exercise: 💪 운동기록 */}
                                        {(() => {
                                            const dayExercises = exerciseRecordsState.filter(r => {
                                                if (!r.date) return false;
                                                const d = r.date instanceof Date ? r.date : (r.date.toDate ? r.date.toDate() : new Date(r.date));
                                                return isSameDay(d, day);
                                            });
                                            const totalDuration = dayExercises.reduce((acc, cur) => acc + (cur.duration || 0), 0);
                                            return totalDuration > 0 ? (
                                                <div className="flex items-center gap-1.5 bg-emerald-500/10 w-full px-2 py-0.5 rounded-lg border border-emerald-500/20 truncate">
                                                    <Dumbbell className="w-2.5 h-2.5 text-emerald-400" />
                                                    <span className="text-[10px] font-black text-emerald-300 truncate">{totalDuration}m</span>
                                                </div>
                                            ) : <div className="h-[21px]" />;
                                        })()}

                                        {/* 3. Reading: 📚 독서기록 */}
                                        {(() => {
                                            const dayReading = readingRecordsState.filter(r => {
                                                if (!r.date) return false;
                                                const d = r.date instanceof Date ? r.date : (r.date.toDate ? r.date.toDate() : new Date(r.date));
                                                return isSameDay(d, day);
                                            });
                                            const totalPages = dayReading.reduce((acc, cur) => acc + (cur.amount || 0), 0);
                                            return totalPages > 0 ? (
                                                <div className="flex items-center gap-1.5 bg-blue-500/10 w-full px-2 py-0.5 rounded-lg border border-blue-500/20 truncate">
                                                    <BookOpen className="w-2.5 h-2.5 text-blue-400" />
                                                    <span className="text-[10px] font-black text-blue-300 truncate">{totalPages}p</span>
                                                </div>
                                            ) : <div className="h-[21px]" />;
                                        })()}
                                    </div>
                                </motion.div>
                            </Link>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
