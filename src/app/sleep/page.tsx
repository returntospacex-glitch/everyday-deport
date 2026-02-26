"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
    Moon,
    Sun,
    Clock,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    CalendarDays,
    Calendar as CalendarIcon,
    Flame,
    TrendingUp,
    RotateCcw,
    LineChart as ChartIcon,
    Maximize2,
    X,
    Trophy
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ko } from "date-fns/locale";
import { sleepRecords, getMonthlySleepStats, SleepRecord } from "@/lib/sleepData";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addDays, subDays, parse } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";
import {
    collection,
    onSnapshot,
    addDoc,
    query,
    orderBy,
    Timestamp,
    serverTimestamp,
    QuerySnapshot,
    DocumentData,
    deleteDoc,
    doc,
    setDoc
} from "firebase/firestore";

// 시간 입력 컴포넌트
const TimeInput = ({ label, icon: Icon, h, setH, m, setM, ampm, setAmpm, hRef, mRef, nextRef }: any) => {
    const handleHChange = (val: string) => {
        const numeric = val.replace(/[^0-9]/g, '').slice(0, 2);
        const num = parseInt(numeric);
        if (numeric.length === 2 && (num < 1 || num > 12)) {
            setH("01");
            return;
        }
        setH(numeric);
        if (numeric.length === 2) setTimeout(() => mRef.current?.focus(), 10);
    };

    const handleMChange = (val: string) => {
        const numeric = val.replace(/[^0-9]/g, '').slice(0, 2);
        const num = parseInt(numeric);
        if (numeric.length === 2 && (num < 0 || num > 59)) {
            setM("00");
            return;
        }
        setM(numeric);
        if (numeric.length === 2 && nextRef) setTimeout(() => nextRef.current?.focus(), 10);
    };

    return (
        <div className="space-y-2">
            <label className="text-[12px] font-black text-white/50 flex items-center gap-2">
                <Icon className="w-4 h-4" /> {label}
            </label>
            <div className="flex items-center gap-2">
                <div className="flex-1 h-16 flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl focus-within:border-purple-500/50 transition-all cursor-text relative group">
                    <input
                        ref={hRef}
                        type="text"
                        inputMode="numeric"
                        value={h}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleHChange(e.target.value)}
                        className="w-12 bg-transparent text-3xl font-black text-center focus:outline-none text-white selection:bg-purple-500/30 font-mono tracking-tighter"
                        placeholder="12"
                    />
                    <span className="text-white/30 font-black text-2xl mb-1">:</span>
                    <input
                        ref={mRef}
                        type="text"
                        inputMode="numeric"
                        value={m}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleMChange(e.target.value)}
                        className="w-12 bg-transparent text-3xl font-black text-center focus:outline-none text-white selection:bg-purple-500/30 font-mono tracking-tighter"
                        placeholder="00"
                    />
                </div>
                <button
                    onClick={() => setAmpm(ampm === "AM" ? "PM" : "AM")}
                    className="w-20 h-16 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-95 group hover:bg-white/10"
                >
                    <span className={`text-[11px] font-black tracking-tighter ${ampm === 'AM' ? 'text-purple-400' : 'text-white/40'}`}>AM</span>
                    <span className={`text-[11px] font-black tracking-tighter ${ampm === 'PM' ? 'text-purple-400' : 'text-white/40'}`}>PM</span>
                </button>
            </div>
        </div>
    );
};

export default function SleepPage() {
    const { user } = useAuth();
    const [bedH, setBedH] = useState("11");
    const [bedM, setBedM] = useState("00");
    const [bedAmpm, setBedAmpm] = useState("PM");
    const [wakeH, setWakeH] = useState("07");
    const [wakeM, setWakeM] = useState("00");
    const [wakeAmpm, setWakeAmpm] = useState("AM");
    const [isSaved, setIsSaved] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showFullHistory, setShowFullHistory] = useState(false);
    const [showLargeMonthly, setShowLargeMonthly] = useState(false);

    const bedHRef = useRef<HTMLInputElement>(null);
    const bedMRef = useRef<HTMLInputElement>(null);
    const wakeHRef = useRef<HTMLInputElement>(null);
    const wakeMRef = useRef<HTMLInputElement>(null);

    const [records, setRecords] = useState<SleepRecord[]>([]);

    const [isLoaded, setIsLoaded] = useState(false);

    // Firestore Load (Real-time)
    useEffect(() => {
        if (!user) return;

        const db = getFirebaseDb();
        const q = query(
            collection(db, "users", user.uid, "sleep"),
            orderBy("date", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            const sleepList = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    date: (data.date as Timestamp)?.toDate(),
                    bedTime: (data.bedtime as Timestamp)?.toDate(),
                    wakeTime: (data.wakeUp as Timestamp)?.toDate(),
                    duration: data.hoursSlept,
                    quality: (data.hoursSlept > 7.5 ? 4 : data.hoursSlept > 6.5 ? 3 : data.hoursSlept > 5.5 ? 2 : 1) as 1 | 2 | 3 | 4
                };
            }) as SleepRecord[];

            // Merge with sleepRecords (mock data) if needed, but for now just use Firestore
            // If FireStore is empty, it will be handled by migration below
            setRecords(sleepList.sort((a, b) => a.date.getTime() - b.date.getTime()));
            setIsLoaded(true);
        }, (error) => {
            console.error("Firestore onSnapshot error (sleep):", error);
            setIsLoaded(true);
        });

        return () => unsubscribe();
    }, [user]);

    // Migration logic
    useEffect(() => {
        if (!user || !isLoaded) return;

        const migrationDone = localStorage.getItem('migration_done_sleep');
        if (migrationDone === 'true') return;

        const localRecordsStr = localStorage.getItem('sleep_records_v1');

        // If Firestore has only mock-level data or is empty, and we have local data
        if (localRecordsStr && records.length <= 10) {
            const db = getFirebaseDb();
            try {
                const localRecords = JSON.parse(localRecordsStr);
                localRecords.forEach(async (record: any) => {
                    const { date, bedTime, wakeTime, duration } = record;
                    await addDoc(collection(db, "users", user.uid, "sleep"), {
                        date: Timestamp.fromDate(new Date(date)),
                        bedtime: Timestamp.fromDate(new Date(bedTime)),
                        wakeUp: Timestamp.fromDate(new Date(wakeTime)),
                        hoursSlept: duration,
                        createdAt: serverTimestamp(),
                    });
                });
                localStorage.setItem('migration_done_sleep', 'true');
                console.log("Sleep data migration completed.");
            } catch (e) {
                console.error("Migration error (sleep):", e);
            }
        }
    }, [user, isLoaded, records.length]);


    // Sync input fields when selectedDate changes (to edit existing records)
    useEffect(() => {
        const record = records.find(r => isSameDay(r.date, selectedDate));
        if (record) {
            const bh = record.bedTime.getHours();
            const bm = record.bedTime.getMinutes();
            setBedH((bh % 12 || 12).toString().padStart(2, '0'));
            setBedM(bm.toString().padStart(2, '0'));
            setBedAmpm(bh >= 12 ? "PM" : "AM");

            const wh = record.wakeTime.getHours();
            const wm = record.wakeTime.getMinutes();
            setWakeH((wh % 12 || 12).toString().padStart(2, '0'));
            setWakeM(wm.toString().padStart(2, '0'));
            setWakeAmpm(wh >= 12 ? "PM" : "AM");
        } else {
            // Default reset if no record exists for the selected date
            setBedH("11"); setBedM("00"); setBedAmpm("PM");
            setWakeH("07"); setWakeM("00"); setWakeAmpm("AM");
        }
    }, [selectedDate, records.length]); // Re-sync when date changes or records are loaded/saved

    const isTodaySelected = isSameDay(selectedDate, new Date());

    const getSleepColor = (hours: number) => {
        if (hours < 4) return "rgb(239, 68, 68)"; // 4시간 미만 - 빨간색
        if (hours <= 6) return "rgb(234, 179, 8)"; // 6시간 이하 - 노란색
        if (hours <= 7.5) return "rgb(34, 197, 94)"; // 7시간 반 이하 - 초록색
        if (hours <= 9) return "rgb(59, 130, 246)"; // 7.5 - 9 파란색
        return "rgb(34, 197, 94)"; // 9 이상 초록색
    };

    const formatDecimalTime = (decimalTime: number) => {
        let hours = Math.floor(decimalTime);
        const minutes = Math.round((decimalTime - hours) * 60);
        const ampm = hours >= 24 || (hours >= 0 && hours < 12) ? "AM" : "PM";
        let displayHours = hours % 24;
        if (displayHours === 0) displayHours = 12;
        else if (displayHours > 12) displayHours -= 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    };

    const stats = useMemo(() => {
        const today = new Date();
        const recentDays = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
        const prevDays = Array.from({ length: 7 }, (_, i) => subDays(today, 13 - i));

        const recentTrend = recentDays.map(day => {
            const r = records.find(rec => isSameDay(rec.date, day));
            return { date: format(day, 'M/d'), hours: r ? r.duration : 0 };
        });

        const bedtimeConsistency = recentDays.map(day => {
            const r = records.find(rec => isSameDay(rec.date, day));
            let timeVal = 23.0;
            if (r) {
                let h = r.bedTime.getHours();
                let m = r.bedTime.getMinutes();
                timeVal = h + (m / 60);
                if (timeVal < 12) timeVal += 24;
            }
            return { date: format(day, 'M/d'), time: parseFloat(timeVal.toFixed(3)) };
        });

        const currentAvg = recentTrend.reduce((acc, curr) => acc + curr.hours, 0) / 7;
        const prevTrend = prevDays.map(day => {
            const r = records.find(rec => isSameDay(rec.date, day));
            return r ? r.duration : 0;
        });
        const prevAvg = prevTrend.reduce((acc, curr) => acc + curr, 0) / 7;
        const diffHours = currentAvg - prevAvg;
        const totalMinutes = Math.abs(Math.round(diffHours * 60));
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;

        let diffLabel = "";
        if (h > 0) {
            diffLabel = `${h}시간 ${m > 0 ? `${m}분 ` : ""}${diffHours >= 0 ? "증가" : "감소"}`;
        } else {
            diffLabel = `${m}분 ${diffHours >= 0 ? "증가" : "감소"}`;
        }

        const monthly = getMonthlySleepStats(selectedDate, records);

        const result: any = {
            avgSleep: `${currentAvg.toFixed(1)}h`,
            avgSleepLabel: `지난주 대비 ${diffLabel}`,
            consistency: monthly.avgQuality ? `${(parseFloat(monthly.avgQuality) * 25).toFixed(0)}%` : "0%",
            consistencyScore: 0,
            consistencyLabel: "데이터 부족",
            recentTrend,
            bedtimeConsistency,
            monthlyStats: monthly.weeklyBreakdown.map((w, i) => ({
                ...w,
                avgInfo: w.avg,
                color: i === 0 ? "from-purple-500 to-purple-400" : i === 1 ? "from-indigo-500 to-indigo-400" : i === 2 ? "from-blue-500 to-blue-400" : "from-violet-500 to-violet-400"
            })),
            monthlyTrend: Array.from(new Set(records.map(r => format(startOfMonth(r.date), 'yyyy-MM'))))
                .sort()
                .slice(-3)
                .map(monthStr => {
                    const monthDate = parse(monthStr, 'yyyy-MM', new Date());
                    const mStats = getMonthlySleepStats(monthDate, records);
                    return {
                        month: format(monthDate, 'M월'),
                        fullDate: monthDate,
                        avg: parseFloat(mStats.avgDuration)
                    };
                })
        };

        // Calculate Consistency Score based on Standard Deviation (7 days)
        const validBedtimes = bedtimeConsistency.filter(d => {
            const r = records.find(rec => format(rec.date, 'M/d') === d.date);
            return !!r;
        }).map(d => d.time * 60); // Convert to minutes

        if (validBedtimes.length > 1) {
            const avgTime = validBedtimes.reduce((a, b) => a + b, 0) / validBedtimes.length;
            const variance = validBedtimes.reduce((a, b) => a + Math.pow(b - avgTime, 2), 0) / validBedtimes.length;
            const stdDev = Math.sqrt(variance);

            // Scoring Logic: SD <= 10min -> 100, SD >= 120min -> 0
            let score = Math.max(0, 100 - (stdDev - 10) * (100 / 110));
            if (stdDev <= 10) score = 100;

            let label = "매우 안정적";
            if (score < 50) label = "매우 불규칙";
            else if (score < 80) label = "약간 불규칙";

            result.consistency = `${score.toFixed(0)}%`;
            result.consistencyScore = score;
            result.consistencyLabel = label;
        }

        return result;
    }, [records, selectedDate]);

    const handleSave = async () => {
        if (!user) return;

        let startH = parseInt(bedH);
        if (bedAmpm === "PM" && startH !== 12) startH += 12;
        if (bedAmpm === "AM" && startH === 12) startH = 0;
        let endH = parseInt(wakeH);
        if (wakeAmpm === "PM" && endH !== 12) endH += 12;
        if (wakeAmpm === "AM" && endH === 12) endH = 0;

        let duration = (endH + (parseInt(wakeM) / 60)) - (startH + (parseInt(bedM) / 60));
        if (duration <= 0) duration += 24;

        const db = getFirebaseDb();
        try {
            const bedtimeDate = new Date(selectedDate);
            bedtimeDate.setHours(startH, parseInt(bedM));

            const wakeUpDate = new Date(addDays(new Date(selectedDate), (startH + (parseInt(bedM) / 60) + duration > 23.9) ? 1 : 0));
            wakeUpDate.setHours(endH, parseInt(wakeM));

            const existingRecord = records.find(r => isSameDay(r.date, selectedDate));

            if (existingRecord && (existingRecord as any).id) {
                // Update (Actually we need setDoc or updateDoc, but for simplicity let's use the ID if we have it)
                // Wait, SleepRecord interface doesn't have ID. Let's add it locally or use collection/add if new.
                // In my onSnapshot, I added ID.
                await setDoc(doc(db, "users", user.uid, "sleep", (existingRecord as any).id), {
                    date: Timestamp.fromDate(new Date(selectedDate)),
                    bedtime: Timestamp.fromDate(bedtimeDate),
                    wakeUp: Timestamp.fromDate(wakeUpDate),
                    hoursSlept: parseFloat(duration.toFixed(3)),
                    updatedAt: serverTimestamp()
                }, { merge: true });
            } else {
                await addDoc(collection(db, "users", user.uid, "sleep"), {
                    date: Timestamp.fromDate(new Date(selectedDate)),
                    bedtime: Timestamp.fromDate(bedtimeDate),
                    wakeUp: Timestamp.fromDate(wakeUpDate),
                    hoursSlept: parseFloat(duration.toFixed(3)),
                    createdAt: serverTimestamp(),
                });
            }

            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 3000);
        } catch (e) {
            console.error("Failed to save sleep record:", e);
            alert("저장에 실패했습니다.");
        }
    };

    return (
        <div className="w-full space-y-10 py-6 animate-in fade-in duration-700">
            {/* Header */}
            <header className="flex items-center justify-between px-4 sm:px-0">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all">
                        <ChevronLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="text-[2.6rem] md:text-[3.1rem] font-black tracking-tighter text-white leading-tight bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-transparent">수면 대시보드</h1>
                </div>
                <div className="flex items-center gap-3 bg-purple-500/10 px-4 py-2 rounded-2xl border border-purple-500/20">
                    <Moon className="text-purple-400 w-5 h-5" />
                    <span className="text-sm font-black text-purple-400 tracking-widest leading-none">RESTING</span>
                </div>
            </header>

            {/* TOP Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 sm:px-0">
                <section className="lg:col-span-2 glass p-8 space-y-6 h-[324px]">
                    <div className="space-y-1">
                        <h3 className="text-3xl font-black text-white tracking-tighter">최근 7일 수면 시간</h3>
                        <p className="text-xs text-white/40 font-black tracking-widest uppercase">일주일간의 수면 흐름을 한눈에 확인하세요.</p>
                    </div>
                    <div className="h-60 flex items-end justify-between gap-4 px-2 pb-2">
                        {stats.recentTrend.map((data: any, i: number) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                                <span className="absolute -top-7 text-[12px] font-black text-white">{data.hours}h</span>
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${data.hours * 16}px` }}
                                    className={`w-full max-w-[44px] rounded-t-[18px] transition-all relative overflow-hidden shadow-2xl ${data.hours < 6.5 ? "bg-gradient-to-t from-red-600 to-red-400 shadow-red-500/30" : "bg-gradient-to-t from-purple-600 to-purple-400 shadow-purple-500/30"}`}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-60" />
                                    <div className="absolute top-0 left-0 right-0 h-1/4 bg-white/20 blur-sm" />
                                </motion.div>
                                <span className="text-xs text-white/40 font-black tracking-tighter">{data.date}</span>
                            </div>
                        ))}
                    </div>
                </section>
                <div className="space-y-6">
                    <div className="glass p-7 flex flex-col justify-between h-[150px] relative overflow-hidden group">
                        <TrendingUp className="absolute top-4 right-4 w-12 h-12 text-white/5" />
                        <span className="text-xs font-black text-white/40 uppercase tracking-widest">평균 수면 시간</span>
                        <div className="text-5xl md:text-6xl font-black text-white tracking-tighter">{stats.avgSleep}</div>
                        <div className="text-xs text-green-400 font-black bg-green-400/10 px-3.5 py-1.5 rounded-full w-fit tracking-tighter shadow-lg shadow-green-500/10">{stats.avgSleepLabel}</div>
                    </div>
                    <div className="glass p-7 flex flex-col justify-between h-[150px] relative overflow-hidden group">
                        <Flame className="absolute top-4 right-4 w-12 h-12 text-white/5" />
                        <span className="text-xs font-black text-white/40 uppercase tracking-widest">취침 일관성</span>
                        <div className="text-5xl md:text-6xl font-black text-white tracking-tighter">{stats.consistency}</div>
                        <div className={`text-xs font-black px-3.5 py-1.5 rounded-full w-fit tracking-tighter shadow-lg 
                            ${stats.consistencyScore >= 80 ? 'text-purple-400 bg-purple-400/10 shadow-purple-500/10' :
                                stats.consistencyScore >= 50 ? 'text-yellow-400 bg-yellow-400/10 shadow-yellow-500/10' :
                                    'text-red-400 bg-red-400/10 shadow-red-500/10'}`}>
                            {stats.consistencyLabel}
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle Section */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 px-4 sm:px-0">
                <section className="xl:col-span-3 glass p-8 space-y-6 h-[480px] flex flex-col relative overflow-hidden">
                    <div className="space-y-1">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">취침 시간 타임라인</h3>
                        <p className="text-xs text-white/40 font-black uppercase tracking-widest mt-1">최근 7일간의 일관성을 확인하세요.</p>
                    </div>

                    <div className="flex-1 relative mt-6 px-4 mb-4">
                        {(() => {
                            const times = stats.bedtimeConsistency.map((d: any) => d.time);
                            const minTime = Math.min(...times) - 0.5;
                            const maxTime = Math.max(...times) + 0.5;
                            const range = maxTime - minTime || 1;

                            return (
                                <>
                                    <svg className="absolute inset-0 w-full h-full overflow-visible">
                                        <defs>
                                            <linearGradient id="lineGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.1" />
                                                <stop offset="50%" stopColor="#a78bfa" stopOpacity="1" />
                                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
                                            </linearGradient>
                                            <filter id="textGlow">
                                                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                                <feMerge>
                                                    <feMergeNode in="coloredBlur" />
                                                    <feMergeNode in="SourceGraphic" />
                                                </feMerge>
                                            </filter>
                                        </defs>

                                        <line x1="0" y1="25%" x2="100%" y2="25%" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" />
                                        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                                        <line x1="0" y1="75%" x2="100%" y2="75%" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" />

                                        <motion.svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                                            <polyline
                                                fill="none"
                                                stroke="url(#lineGlow)"
                                                strokeWidth="4"
                                                strokeLinejoin="round"
                                                strokeLinecap="round"
                                                filter="url(#textGlow)"
                                                points={stats.bedtimeConsistency.map((item: any, i: number) => {
                                                    const x = ((i + 0.5) / stats.bedtimeConsistency.length) * 100;
                                                    const y = ((item.time - minTime) / range) * 100;
                                                    return `${x},${y}`;
                                                }).join(" ")}
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        </motion.svg>
                                    </svg>

                                    <div className="relative w-full h-full flex justify-between items-center z-10">
                                        {stats.bedtimeConsistency.map((item: any, i: number) => {
                                            const yPos = ((item.time - minTime) / range) * 100;
                                            const isLate = item.time >= 23.5;

                                            return (
                                                <div key={i} className="flex-1 h-full relative group flex flex-col items-center">
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.5 }}
                                                        animate={{ top: `${yPos}%`, opacity: 1, scale: 1 }}
                                                        className="absolute z-30 -translate-y-[210%] text-center pointer-events-none"
                                                    >
                                                        <div className={`text-[11px] font-black tracking-tighter whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${isLate ? 'text-red-400' : 'text-white'}`}>
                                                            {formatDecimalTime(item.time)}
                                                        </div>
                                                    </motion.div>

                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ top: `${yPos}%`, scale: 1 }}
                                                        className={`absolute w-9 h-9 rounded-full border-2 flex items-center justify-center -translate-y-1/2 z-20 transition-all ${isLate ? 'bg-red-500 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-purple-500 border-white text-white shadow-[0_0_20px_rgba(168,85,247,0.5)]'}`}
                                                    >
                                                        <Moon className="w-3.5 h-3.5 fill-current" />
                                                    </motion.div>

                                                    <div className="absolute bottom-[-28px] text-center w-full">
                                                        <div className="text-[11px] text-white/60 font-black tracking-tight whitespace-nowrap uppercase">{item.date}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </section>

                <section className="xl:col-span-2 glass p-8 space-y-6 border-purple-500/20 shadow-xl shadow-purple-500/5 h-full flex flex-col">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/10 shadow-inner">
                                <CheckCircle2 className="w-6 h-6 text-purple-400" />
                            </div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter whitespace-nowrap">수면 기록</h3>
                        </div>
                        <div className="flex items-center justify-between gap-3 bg-white/5 p-1.5 px-3 rounded-full border border-white/10 w-full max-w-[180px] shadow-inner relative group">
                            <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="text-white/30 hover:text-white transition-all active:scale-90"><ChevronLeft className="w-5 h-5" /></button>
                            <div className="flex flex-col items-center">
                                {isTodaySelected && <span className="text-[8px] font-black text-white/40 tracking-widest absolute -top-2 bg-purple-600 px-2 rounded-full text-white">TODAY</span>}
                                <span className="text-[13px] font-black text-purple-400 tracking-tighter whitespace-nowrap">{format(selectedDate, 'yyyy. MM. dd')}</span>
                            </div>
                            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="text-white/30 hover:text-white transition-all active:scale-90"><ChevronRight className="w-5 h-5" /></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 space-y-8 py-2">
                        <TimeInput label="취침 시간" icon={Moon} h={bedH} setH={setBedH} m={bedM} setM={setBedM} ampm={bedAmpm} setAmpm={setBedAmpm} hRef={bedHRef} mRef={bedMRef} nextRef={wakeHRef} />
                        <TimeInput label="기상 시간" icon={Sun} h={wakeH} setH={setWakeH} m={wakeM} setM={setWakeM} ampm={wakeAmpm} setAmpm={setWakeAmpm} hRef={wakeHRef} mRef={wakeMRef} />
                    </div>

                    <button onClick={handleSave} className={`w-full py-5 rounded-xl font-black text-xl shadow-[0_10px_20px_rgba(109,40,217,0.25)] transition-all active:scale-95 mt-auto ${isSaved ? 'bg-green-500 text-black' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:brightness-110 active:brightness-90'}`}>
                        {isSaved ? "저장 완료!" : "기록 저장하기"}
                    </button>
                </section>
            </div>

            {/* Monthly Calendar */}
            <section className="glass px-2 py-10 space-y-8 mx-4 sm:mx-0">
                <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-4 text-white">
                        <CalendarIcon className="w-8 h-8 text-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]" />
                        <h3 className="text-3xl font-black tracking-tighter uppercase">월간 수면 현황</h3>
                    </div>
                    <button
                        onClick={() => setShowLargeMonthly(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[13px] font-black text-white/60 hover:bg-white/10 transition-all group shadow-lg"
                    >
                        <Maximize2 className="w-4 h-4" />
                        기록 크게 보기
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-px bg-white/5 border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
                    {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                        <div key={day} className={`p-5 text-center text-base font-black bg-white/[0.03] ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-white/60'}`}>{day}</div>
                    ))}
                    {(() => {
                        const monthStart = startOfMonth(selectedDate);
                        const monthEnd = endOfMonth(selectedDate);
                        const days = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });
                        return days.map(day => {
                            const r = records.find(rec => isSameDay(rec.date, day));
                            const isCurrentMonth = isSameMonth(day, monthStart);
                            return (
                                <div key={day.toISOString()} onClick={() => setSelectedDate(day)} className={`min-h-[120px] p-4 border-t border-white/5 relative group transition-all cursor-pointer hover:bg-white/5 ${!isCurrentMonth ? 'opacity-10' : 'opacity-100'} ${isSameDay(day, selectedDate) ? 'bg-purple-500/10' : ''}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[18px] font-black ${isSameDay(day, new Date()) ? 'text-purple-400' : 'text-white/30'}`}>{format(day, 'd')}</span>
                                        {r && <span className="text-[18px] font-black tracking-tighter drop-shadow-md" style={{ color: getSleepColor(r.duration) }}>{r.duration}h</span>}
                                    </div>
                                    {r && (
                                        <div className="mt-3 space-y-2">
                                            <div className="flex flex-col gap-1.5 pt-1">
                                                <div className="flex justify-between text-[13px] font-black text-white/60 tracking-tighter uppercase">
                                                    <span>취침시간</span>
                                                    <span className="text-white font-mono text-[14px]">{format(r.bedTime, 'HH:mm')}</span>
                                                </div>
                                                <div className="flex justify-between text-[13px] font-black text-white/60 tracking-tighter uppercase">
                                                    <span>기상시간</span>
                                                    <span className="text-white font-mono text-[14px]">{format(r.wakeTime, 'HH:mm')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        });
                    })()}
                </div>
            </section>

            {/* Bottom Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 sm:px-0 pb-10">
                <section className="glass p-8 space-y-4 flex flex-col h-[340px]">
                    <h4 className="text-xl font-black text-white tracking-widest flex items-center gap-3"><Clock className="w-5 h-5 text-purple-400" /> 주차별 분석</h4>
                    <div className="flex-1 flex items-end gap-5 px-2 pb-2">
                        {stats.monthlyStats.map((week: any, i: number) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative">
                                <span className="absolute -top-7 text-[13px] font-black text-white">{week.avg}h</span>
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${week.avg * 18}px` }}
                                    className={`w-full bg-gradient-to-t ${week.color} rounded-t-[20px] transition-all relative overflow-hidden shadow-xl cursor-pointer group-hover:brightness-110`}
                                >
                                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-tr from-white/30 to-transparent opacity-60" />
                                    <div className="absolute top-1 left-1 right-1 h-1/4 bg-white/20 blur-sm rounded-full" />
                                </motion.div>
                                <span className="text-[11px] font-black text-white/30 tracking-tight">{i + 1}주차</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="glass p-8 space-y-4 flex flex-col h-[340px]">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xl font-black text-white tracking-widest flex items-center gap-3"><ChartIcon className="w-5 h-5 text-rose-500" /> 월별 수면 기록</h4>
                        <button
                            onClick={() => setShowFullHistory(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[11px] font-black text-white/40 hover:text-white hover:bg-white/10 transition-all group"
                        >
                            <Maximize2 className="w-3 h-3 transition-transform group-hover:scale-125" />
                            월별 기록 크게 보기
                        </button>
                    </div>
                    <div className="flex-1 flex items-end gap-5 px-2 pb-2">
                        {stats.monthlyTrend.map((item: any, i: number) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative cursor-pointer" onClick={() => setSelectedDate(item.fullDate)}>
                                <span className={`absolute -top-7 text-[13px] font-black transition-all ${isSameMonth(selectedDate, item.fullDate) ? 'text-purple-400 scale-110' : 'text-white'}`}>{item.avg}h</span>
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${(item.avg - 4) * 30}px` }}
                                    className={`w-full rounded-t-[20px] transition-all relative overflow-hidden shadow-xl group-hover:brightness-110 ${isSameMonth(selectedDate, item.fullDate) ? 'ring-2 ring-purple-400 ring-offset-4 ring-offset-transparent' : ''}`}
                                    style={{
                                        background: isSameMonth(selectedDate, item.fullDate)
                                            ? `linear-gradient(to top, rgb(168, 85, 247), rgba(168, 85, 247, 0.4))`
                                            : `linear-gradient(to top, ${getSleepColor(item.avg)}, rgba(255,255,255,0.3))`
                                    }}
                                >
                                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-tr from-white/30 to-transparent opacity-60" />
                                    <div className="absolute top-1 left-1 right-1 h-1/4 bg-white/20 blur-sm rounded-full" />
                                </motion.div>
                                <span className={`text-[11px] font-black tracking-tight transition-all ${isSameMonth(selectedDate, item.fullDate) ? 'text-purple-400' : 'text-white/30'}`}>{item.month}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* 전체 히스토리 모달 (Years -> Months) */}
            <AnimatePresence>
                {showFullHistory && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col p-8 sm:p-12 overflow-y-auto no-scrollbar"
                    >
                        <div className="max-w-6xl mx-auto w-full space-y-16">
                            <div className="flex items-center justify-between sticky top-0 bg-black/0 py-6 z-10 backdrop-blur-md border-b border-white/5">
                                <div className="space-y-2">
                                    <h2 className="text-5xl font-black text-white tracking-tighter uppercase">월별 수면 기록 히스토리</h2>
                                    <p className="text-xl text-white/40 font-black tracking-widest uppercase">과거의 모든 수면 통계와 일별 상세 기록을 확인하세요</p>
                                </div>
                                <button
                                    onClick={() => setShowFullHistory(false)}
                                    className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all border border-white/10 shadow-2xl"
                                >
                                    <X className="w-8 h-8" />
                                </button>
                            </div>

                            <div className="space-y-24 pb-20">
                                {(() => {
                                    // 기록된 모든 고유 연도 추출
                                    const years = Array.from(new Set(records.map(r => format(r.date, 'yyyy')))).sort().reverse();

                                    return years.map(year => {
                                        const yearMonths = Array.from(new Set(
                                            records
                                                .filter(r => format(r.date, 'yyyy') === year)
                                                .map(r => format(startOfMonth(r.date), 'yyyy-MM'))
                                        )).sort().reverse();

                                        return (
                                            <div key={year} className="space-y-8">
                                                <div className="flex items-center gap-6">
                                                    <h3 className="text-5xl font-black text-white/10 tracking-tighter">{year}</h3>
                                                    <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                                    {yearMonths.map(monthStr => {
                                                        const monthDate = parse(monthStr, 'yyyy-MM', new Date());
                                                        const mStats = getMonthlySleepStats(monthDate, records);
                                                        const isSelected = isSameMonth(selectedDate, monthDate);

                                                        return (
                                                            <motion.div
                                                                key={monthStr}
                                                                whileHover={{ scale: 1.02, y: -5 }}
                                                                whileTap={{ scale: 0.98 }}
                                                                onClick={() => {
                                                                    setSelectedDate(monthDate);
                                                                    setShowFullHistory(false);
                                                                    setShowLargeMonthly(true);
                                                                }}
                                                                className={`glass p-8 cursor-pointer border-white/5 hover:border-purple-500/30 transition-all group relative overflow-hidden ${isSelected ? 'ring-2 ring-purple-500/50 bg-purple-500/5' : ''}`}
                                                            >
                                                                {isSelected && <div className="absolute top-0 right-0 p-2 bg-purple-500 text-white text-[10px] font-black uppercase tracking-tighter">Selected</div>}

                                                                <div className="flex justify-between items-start mb-6">
                                                                    <div className="space-y-1">
                                                                        <span className="text-[12px] font-black text-white/30 uppercase tracking-widest">{year}</span>
                                                                        <h4 className={`text-3xl font-black transition-colors ${isSelected ? 'text-purple-400' : 'text-white/60 group-hover:text-white'}`}>
                                                                            {format(monthDate, 'M월')}
                                                                        </h4>
                                                                    </div>
                                                                    <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-purple-500/20 transition-colors">
                                                                        <ChartIcon className={`w-6 h-6 ${isSelected ? 'text-purple-400' : 'text-white/20'}`} />
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-5">
                                                                    <div className="flex justify-between items-end">
                                                                        <span className="text-[11px] font-black text-white/40 tracking-widest uppercase">월 평균 수면</span>
                                                                        <span className="text-2xl font-black text-white">{mStats.avgDuration}h</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-end">
                                                                        <span className="text-[11px] font-black text-white/40 tracking-widest uppercase">취침 일관성</span>
                                                                        <span className="text-xl font-bold text-purple-400">
                                                                            {mStats.avgQuality ? `${(parseFloat(mStats.avgQuality) * 25).toFixed(0)}%` : "0%"}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between text-[11px] font-black tracking-[0.2em] uppercase text-white/20 group-hover:text-purple-400/60 transition-colors">
                                                                    <span>자세히 보기</span>
                                                                    <ChevronRight className="w-4 h-4" />
                                                                </div>
                                                            </motion.div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 월간 상세 리포트 모달 (선택한 월의 일별 기록) */}
            <AnimatePresence>
                {showLargeMonthly && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-2xl flex flex-col p-8 sm:p-12 overflow-y-auto no-scrollbar"
                    >
                        <div className="max-w-7xl mx-auto w-full space-y-12">
                            <div className="flex items-center justify-between border-b border-white/10 pb-8 sticky top-0 bg-black/0 z-10 backdrop-blur-md">
                                <div className="space-y-2">
                                    <h2 className="text-5xl font-black text-white tracking-tighter uppercase drop-shadow-2xl">월간 수면 상세 리포트</h2>
                                    <p className="text-xl text-white/40 font-black tracking-widest">{format(selectedDate, 'yyyy년 M월')}의 모든 수면 데이터 분석</p>
                                </div>
                                <button
                                    onClick={() => setShowLargeMonthly(false)}
                                    className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all hover:rotate-90"
                                >
                                    <X className="w-8 h-8" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-12">
                                {records
                                    .filter(r => isSameMonth(r.date, selectedDate))
                                    .sort((a, b) => b.date.getTime() - a.date.getTime())
                                    .map((record, i) => (
                                        <motion.div
                                            key={record.date.toISOString()}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            className="glass-card p-8 space-y-6 group hover:border-purple-500/50 transition-all hover:bg-white/[0.03]"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <span className="text-[13px] font-black text-white/30 uppercase tracking-[0.2em]">{format(record.date, 'EEEE', { locale: ko })}</span>
                                                    <h3 className="text-2xl font-black text-white tracking-tighter">{format(record.date, 'dd일')}</h3>
                                                </div>
                                                <div className="text-center bg-white/5 p-3 rounded-2xl border border-white/10">
                                                    <div className="text-3xl font-black text-purple-400 tracking-tighter">{record.duration}</div>
                                                    <div className="text-[11px] font-black text-white/20 uppercase tracking-widest">hours</div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                                                    <div className="flex items-center gap-3">
                                                        <Moon className="w-5 h-5 text-purple-400" />
                                                        <span className="text-[14px] font-black text-white/60">취침시간</span>
                                                    </div>
                                                    <span className="text-[22px] font-black text-white tracking-tighter">{format(record.bedTime, 'HH:mm')}</span>
                                                </div>
                                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                                                    <div className="flex items-center gap-3">
                                                        <Sun className="w-5 h-5 text-yellow-400" />
                                                        <span className="text-[14px] font-black text-white/60">기상시간</span>
                                                    </div>
                                                    <span className="text-[22px] font-black text-white tracking-tighter">{format(record.wakeTime, 'HH:mm')}</span>
                                                </div>
                                            </div>

                                            <div className="w-full h-2 rounded-full overflow-hidden bg-white/10 relative">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(record.duration / 10) * 100}%` }}
                                                    className="h-full rounded-full shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                                                    style={{ backgroundColor: getSleepColor(record.duration) }}
                                                />
                                            </div>
                                        </motion.div>
                                    ))}
                                {records.filter(r => isSameMonth(r.date, selectedDate)).length === 0 && (
                                    <div className="col-span-full py-20 text-center space-y-4">
                                        <div className="text-6xl opacity-20">🛏️</div>
                                        <p className="text-white/40 font-black text-xl tracking-widest uppercase">이 달의 수면 기록이 아직 없습니다</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx global>{`
                .glass-card {
                    background: rgba(255, 255, 255, 0.02);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 32px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                }
            `}</style>
        </div >
    );
}
