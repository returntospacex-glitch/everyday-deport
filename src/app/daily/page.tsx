"use client";

import { useState, useEffect, useMemo } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Star,
    PenLine,
    Calendar as CalendarIcon,
    Save,
    Smile,
    CalendarDays,
    AlertCircle
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameDay,
    startOfWeek,
    endOfWeek,
    addMonths,
    subMonths,
    isSameMonth,
    isSameWeek,
    parseISO
} from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";
import {
    collection,
    onSnapshot,
    setDoc,
    doc,
    query,
    orderBy
} from "firebase/firestore";

interface DailyRecord {
    id: string;
    date: string; // yyyy-MM-dd
    score: number; // 1-5
    diary: string;
}

export default function DailyPage() {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [records, setRecords] = useState<DailyRecord[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    const [moodScore, setMoodScore] = useState<number>(0);
    const [diary, setDiary] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { user } = useAuth();

    // Averages calculation logic
    const averages = useMemo(() => {
        if (records.length === 0) return { weekly: 0, monthly: 0 };

        const now = new Date();
        const weekRecords = records.filter(r => isSameWeek(parseISO(r.date), now, { weekStartsOn: 0 }));
        const monthRecords = records.filter(r => isSameMonth(parseISO(r.date), now));

        const calcAvg = (recs: DailyRecord[]) => {
            const scores = recs.filter(r => r.score > 0).map(r => r.score);
            return scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "0.0";
        };

        return {
            weekly: calcAvg(weekRecords),
            monthly: calcAvg(monthRecords)
        };
    }, [records]);

    // Firestore Load (Real-time)
    useEffect(() => {
        if (!user) {
            setRecords([]);
            setIsLoaded(true);
            return;
        }

        const db = getFirebaseDb();
        const q = query(
            collection(db, "users", user.uid, "dailyRecords"),
            orderBy("date", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const recordList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as DailyRecord[];
            setRecords(recordList);
            setIsLoaded(true);
            setError(null);
        }, (error) => {
            console.error("Firestore onSnapshot error (dailyRecords):", error);
            if (error.code === 'permission-denied') {
                setError("데이터 접근 권한이 없습니다. Firebase Console에서 규칙 설정을 확인해주세요.");
            } else {
                setError("데이터를 불러오는 중 오류가 발생했습니다.");
            }
            setIsLoaded(true);
        });

        return () => unsubscribe();
    }, [user]);

    // Migration logic
    useEffect(() => {
        if (!user || !isLoaded) return;

        const migrationDone = localStorage.getItem('migration_done_daily');
        if (migrationDone === 'true') return;

        const localDailyStr = localStorage.getItem('daily_records_v1');

        if (localDailyStr && records.length === 0) {
            const db = getFirebaseDb();
            try {
                const localDaily = JSON.parse(localDailyStr);
                localDaily.forEach(async (record: any) => {
                    const { id, date, ...data } = record;
                    // Compatibility check for different schemas
                    const docData = {
                        date: date || record.dateStr,
                        score: record.score || (record.mood === '😊' ? 5 : 3),
                        diary: record.diary || record.highlight || record.memo || ""
                    };
                    await setDoc(doc(db, "users", user.uid, "dailyRecords", docData.date), docData);
                });
                localStorage.setItem('migration_done_daily', 'true');
                console.log("Daily data migration completed.");
            } catch (e) {
                console.error("Migration error (daily):", e);
            }
        }
    }, [user, isLoaded, records.length]);

    // Load current record when selectedDate changes
    useEffect(() => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const record = records.find(r => r.date === dateStr);
        if (record) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setMoodScore(record.score);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDiary(record.diary);
        } else {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setMoodScore(0);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDiary("");
        }
    }, [selectedDate, records]);

    const handleSave = async () => {
        if ((moodScore === 0 && !diary.trim()) || !user) return;

        setIsSaving(true);
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const newRecord: Omit<DailyRecord, 'id'> = {
            date: dateStr,
            score: moodScore,
            diary: diary
        };

        try {
            const db = getFirebaseDb();
            await setDoc(doc(db, "users", user.uid, "dailyRecords", dateStr), newRecord);
            setError(null);
            setTimeout(() => setIsSaving(false), 1000);
        } catch (e: any) {
            console.error("Failed to save daily record", e);
            if (e.code === 'permission-denied') {
                alert("저장 권한이 없습니다. 보안 규칙을 확인해주세요.");
            } else {
                alert("저장에 실패했습니다.");
            }
            setIsSaving(false);
        }
    };

    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [currentMonth]);

    const hasRecord = (day: Date) => {
        return records.some(r => r.date === format(day, 'yyyy-MM-dd'));
    };

    const getDayRecord = (day: Date) => {
        return records.find(r => r.date === format(day, 'yyyy-MM-dd'));
    };

    return (
        <div className="w-full py-6 space-y-8 animate-in fade-in duration-700 pb-20">
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}
            {/* Header */}
            <header className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white">
                        <ChevronLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="text-[2.6rem] md:text-[3.1rem] font-black text-white tracking-tighter flex items-center gap-4 bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-transparent uppercase">
                        하루 기록 대시보드
                        <div className="w-4 h-4 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_20px_rgba(250,204,21,0.7)]" />
                    </h1>
                </div>
                <div className="text-right">
                    <div className="flex items-center gap-3 bg-white/5 p-2 px-4 rounded-2xl border border-white/10 shadow-inner">
                        <button onClick={() => setSelectedDate(subMonths(selectedDate, 1))} className="text-white/30 hover:text-white transition-all"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="text-sm font-black text-yellow-400 tracking-widest uppercase">
                            {format(selectedDate, 'yyyy. MM. dd')}
                        </span>
                        <button onClick={() => setSelectedDate(addMonths(selectedDate, 1))} className="text-white/30 hover:text-white transition-all"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>
            </header>

            {/* Analytics Row */}
            <div className="grid grid-cols-2 gap-4">
                <div className="glass p-6 flex items-center justify-between border-white/5 bg-white/2 hover:bg-white/5 transition-all">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">이번 주 평균</p>
                        <h3 className="text-2xl font-black text-white">{averages.weekly}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                        <Star className="w-5 h-5 text-purple-400 fill-current" />
                    </div>
                </div>
                <div className="glass p-6 flex items-center justify-between border-white/5 bg-white/2 hover:bg-white/5 transition-all">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">이번 달 평균</p>
                        <h3 className="text-2xl font-black text-white">{averages.monthly}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-yellow-400/10 flex items-center justify-center border border-yellow-400/20">
                        <Star className="w-5 h-5 text-yellow-400 fill-current" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Entry Section (7 cols) */}
                <section className="lg:col-span-7 space-y-8">
                    {/* Mood Score */}
                    <div className="glass p-8 space-y-6">
                        <div className="flex items-center gap-3">
                            <Smile className="w-6 h-6 text-yellow-400" />
                            <h2 className="text-xl font-black text-white tracking-tight uppercase">오늘의 기분 점수</h2>
                        </div>
                        <div className="flex justify-between items-center px-4">
                            {[
                                { s: 1, label: "최악", emoji: "😢", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
                                { s: 2, label: "나쁨", emoji: "😞", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
                                { s: 3, label: "그럭저럭", emoji: "😐", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
                                { s: 4, label: "좋음", emoji: "😊", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
                                { s: 5, label: "최고", emoji: "🤩", color: "bg-yellow-400 text-black border-yellow-400 shadow-lg shadow-yellow-400/20" }
                            ].map((item) => (
                                <button
                                    key={item.s}
                                    onClick={() => setMoodScore(item.s)}
                                    className="group relative flex flex-col items-center gap-3"
                                >
                                    <div className={`
                                        w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 border
                                        ${moodScore === item.s
                                            ? item.color
                                            : 'bg-white/5 text-white/20 border-white/5 hover:bg-white/10 hover:border-white/10 hover:scale-105 active:scale-95'}
                                    `}>
                                        <span className={`text-2xl transition-transform duration-300 ${moodScore === item.s ? 'scale-125' : 'grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100'}`}>
                                            {item.emoji}
                                        </span>
                                    </div>
                                    <span className={`text-[11px] font-black tracking-tight transition-colors duration-300 ${moodScore === item.s ? 'text-white' : 'text-white/20 uppercase'}`}>
                                        {item.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Diary Entry */}
                    <div className="glass p-8 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <PenLine className="w-6 h-6 text-purple-400" />
                                <h2 className="text-xl font-black text-white tracking-tight uppercase">오늘의 일기</h2>
                            </div>
                            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Simple Reflection</span>
                        </div>
                        <textarea
                            value={diary}
                            onChange={(e) => setDiary(e.target.value)}
                            placeholder="오늘 하루는 어떠셨나요? 작고 사소한 일이라도 괜찮아요. 솔직한 감정을 적어보세요."
                            className="w-full h-64 bg-white/5 border border-white/10 rounded-3xl p-6 text-lg font-bold text-white placeholder:text-white/10 focus:outline-none focus:border-yellow-400/50 transition-all resize-none shadow-inner"
                        />
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`
                                w-full py-5 rounded-2xl font-black text-lg transition-all active:scale-95 flex items-center justify-center gap-3
                                ${isSaving ? 'bg-green-500 text-black' : 'bg-white text-black hover:bg-yellow-400 hover:shadow-xl hover:shadow-yellow-400/10'}
                                shadow-2xl
                            `}
                        >
                            {isSaving ? (
                                <><Save className="w-6 h-6 animate-bounce" /> 기록 완료!</>
                            ) : (
                                <><Save className="w-6 h-6" /> 하루 기록 저장하기</>
                            )}
                        </button>
                    </div>
                </section>

                {/* Right: Calendar Section (5 cols) */}
                <section className="lg:col-span-5 glass p-8 space-y-8 h-fit sticky top-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <CalendarDays className="w-6 h-6 text-indigo-400" />
                            <h2 className="text-xl font-black text-white tracking-tight uppercase">다이어리 히스토리</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-white/30 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
                            <span className="text-sm font-black text-white">{format(currentMonth, 'yyyy. MM')}</span>
                            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-white/30 hover:text-white"><ChevronRight className="w-5 h-5" /></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                            <span key={i} className={`text-center text-[10px] font-black py-2 ${i === 0 ? 'text-red-400/50' : i === 6 ? 'text-blue-400/50' : 'text-white/20'}`}>{d}</span>
                        ))}
                        {calendarDays.map((day, i) => {
                            const isCurrentDay = isSameDay(day, selectedDate);
                            const dayRecord = getDayRecord(day);
                            const isThisMonth = isSameMonth(day, currentMonth);
                            const isToday = isSameDay(day, new Date());

                            return (
                                <button
                                    key={i}
                                    onClick={() => setSelectedDate(day)}
                                    className={`
                                        aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all group
                                        ${!isThisMonth ? 'opacity-10 grayscale pointer-events-none' : 'opacity-100'}
                                        ${isCurrentDay ? 'bg-white text-black shadow-xl ring-2 ring-yellow-400/50' : 'bg-white/5 hover:bg-white/10 text-white/40'}
                                        ${isToday && !isCurrentDay ? 'border border-yellow-400/30' : ''}
                                    `}
                                >
                                    <span className={`text-xs font-black ${isCurrentDay ? 'text-black' : 'text-white/60'}`}>
                                        {format(day, 'd')}
                                    </span>
                                    {dayRecord && (
                                        <div className={`w-1 h-1 rounded-full mt-1 ${isCurrentDay ? 'bg-black' : 'bg-yellow-400 shadow-[0_0_5px_rgba(250,204,21,1)]'}`} />
                                    )}

                                    {/* Tooltip on hover if record exists */}
                                    {dayRecord && (
                                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 min-w-[120px] shadow-2xl backdrop-blur-md">
                                            <div className="flex items-center gap-1 mb-1">
                                                {[...Array(dayRecord.score)].map((_, i) => (
                                                    <Star key={i} className="w-2 h-2 text-yellow-400 fill-current" />
                                                ))}
                                            </div>
                                            <p className="text-[9px] text-white/60 line-clamp-2 leading-tight">
                                                {dayRecord.diary}
                                            </p>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="bg-white/5 rounded-2xl p-6 border border-white/5 space-y-4">
                        <h4 className="text-xs font-black text-white/40 uppercase tracking-widest">Selected Insight</h4>
                        {moodScore > 0 ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} className={`w-3 h-3 ${i < moodScore ? 'text-yellow-400 fill-current' : 'text-white/10'}`} />
                                        ))}
                                    </div>
                                    <span className="text-[11px] font-black text-white/60">MOOD SCORE: {moodScore}/5</span>
                                </div>
                                <p className="text-sm font-bold text-white/80 leading-relaxed">
                                    {diary || "일기가 아직 작성되지 않았습니다."}
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm font-bold text-white/20">
                                이 날의 기록이 없습니다. 새로운 하루를 기록해 보세요.
                            </p>
                        )}
                    </div>
                </section>
            </div>
        </div >
    );
}
