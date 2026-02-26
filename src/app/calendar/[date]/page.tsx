"use client";

import { use, useState, useEffect } from "react";
import {
    ChevronLeft,
    Moon,
    Sun,
    Clock,
    Dumbbell,
    ArrowLeft,
    CheckCircle2,
    TrendingUp,
    Flame,
    CalendarDays,
    ThumbsUp,
    Timer,
    Utensils,
    BookOpen,
    ChefHat,
    Star,
    Sparkles
} from "lucide-react";
import { useRouter } from "next/navigation";
import { format, parseISO, isSameDay, subDays, differenceInDays } from "date-fns";
import { ko } from "date-fns/locale";
import { motion } from "framer-motion";
import { getSleepRecord } from "@/lib/sleepData";
import { exerciseRecords, ExerciseRecord, mergeExerciseRecords } from "@/lib/exerciseData";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";
import { collection, onSnapshot, Timestamp } from "firebase/firestore";

export default function CalendarDetailPage({ params }: { params: Promise<{ date: string }> }) {
    const router = useRouter();
    const { date } = use(params);
    const targetDate = parseISO(date);

    // 컴포넌트 내에서 실시간 보완
    const [record, setRecord] = useState<any>(null);
    const [dailyExercises, setDailyExercises] = useState<ExerciseRecord[]>([]);
    const [dailyMeals, setDailyMeals] = useState<any[]>([]);
    const [dailyReading, setDailyReading] = useState<any[]>([]);
    const [dailyDiary, setDailyDiary] = useState<any>(null);
    const [streakStatus, setStreakStatus] = useState<{ type: 'streak' | 'gap' | 'first', count: number }>({ type: 'first', count: 0 });
    const [isLoaded, setIsLoaded] = useState(false);

    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        const db = getFirebaseDb();
        const currentTargetDate = parseISO(date);
        const dateStr = format(currentTargetDate, 'yyyy-MM-dd');

        // 1. Sleep Record Loading
        const sleepUnsub = onSnapshot(collection(db, "users", user.uid, "sleep"), (snapshot) => {
            const foundSleep = snapshot.docs
                .map(doc => ({ ...doc.data(), id: doc.id }))
                .find((r: any) => {
                    if (!r.date) return false;
                    const d = r.date?.toDate ? r.date.toDate() : new Date(r.date);
                    return isSameDay(d, currentTargetDate);
                });

            if (foundSleep) {
                const sleepData = foundSleep as any;
                // Field Mapping: Firestore fields are bedtime, wakeUp, hoursSlept
                setRecord({
                    ...sleepData,
                    date: sleepData.date?.toDate ? sleepData.date.toDate() : new Date(sleepData.date),
                    bedTime: sleepData.bedtime?.toDate ? sleepData.bedtime.toDate() : (sleepData.bedTime ? new Date(sleepData.bedTime) : new Date()),
                    wakeTime: sleepData.wakeUp?.toDate ? sleepData.wakeUp.toDate() : (sleepData.wakeTime ? new Date(sleepData.wakeTime) : new Date()),
                    duration: Number(sleepData.hoursSlept || sleepData.duration || 0)
                });
            } else {
                setRecord(getSleepRecord(currentTargetDate));
            }
        });

        // 2. Exercise Record Loading
        const exerciseUnsub = onSnapshot(collection(db, "users", user.uid, "exercises"), (snapshot) => {
            const allExercises = snapshot.docs.map(doc => {
                const data = doc.data() as any;
                let d;
                if (data.date?.toDate) d = data.date.toDate();
                else d = new Date(data.date);

                return {
                    id: doc.id,
                    ...data,
                    date: d
                };
            }).filter(ex => ex.date && !isNaN(ex.date.getTime())) as ExerciseRecord[];

            const dayExercises = allExercises.filter(r => isSameDay(r.date, currentTargetDate));
            setDailyExercises(dayExercises);

            // Streak/Gap Logic
            if (allExercises.length > 0) {
                const sortedDates = allExercises
                    .map(e => format(e.date, 'yyyy-MM-dd'))
                    .sort()
                    .filter((v, i, a) => a.indexOf(v) === i);

                const currentIndex = sortedDates.indexOf(dateStr);
                if (currentIndex !== -1) {
                    let streak = 1;
                    for (let i = currentIndex - 1; i >= 0; i--) {
                        const prevDate = parseISO(sortedDates[i]);
                        const expectedDate = subDays(currentTargetDate, streak);
                        if (isSameDay(prevDate, expectedDate)) streak++;
                        else break;
                    }
                    if (streak > 1) setStreakStatus({ type: 'streak', count: streak });
                    else if (currentIndex > 0) {
                        const lastDate = parseISO(sortedDates[currentIndex - 1]);
                        const gap = differenceInDays(currentTargetDate, lastDate);
                        setStreakStatus({ type: 'gap', count: gap });
                    } else setStreakStatus({ type: 'first', count: 0 });
                }
            }
        });

        // 3. Meal Record Loading
        const mealUnsub = onSnapshot(collection(db, "users", user.uid, "meals"), (snapshot) => {
            const dayMeals = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter((m: any) => {
                    if (typeof m.date === 'string') return m.date === dateStr;
                    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
                    return d && !isNaN(d.getTime()) && format(d, 'yyyy-MM-dd') === dateStr;
                });
            setDailyMeals(dayMeals);
        });

        // 4. Reading Record Loading
        const readingUnsub = onSnapshot(collection(db, "users", user.uid, "readingSessions"), (snapshot) => {
            const dayReading = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter((r: any) => {
                    if (!r.date) return false;
                    const sessionDate = r.date?.toDate ? r.date.toDate() : new Date(r.date);
                    return isSameDay(sessionDate, currentTargetDate);
                });
            setDailyReading(dayReading);
        });

        // 5. Daily Diary Loading
        const diaryUnsub = onSnapshot(collection(db, "users", user.uid, "dailyRecords"), (snapshot) => {
            const dayDiary = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .find((r: any) => {
                    if (typeof r.date === 'string') return r.date === dateStr;
                    const d = r.date?.toDate ? r.date.toDate() : new Date(r.date);
                    return d && !isNaN(d.getTime()) && format(d, 'yyyy-MM-dd') === dateStr;
                });
            setDailyDiary(dayDiary);
        });

        setIsLoaded(true);

        return () => {
            sleepUnsub();
            exerciseUnsub();
            mealUnsub();
            readingUnsub();
            diaryUnsub();
        };
    }, [user, date]);

    const sleepRecord = record;

    // Sleep Color Logic
    const getSleepColorStub = (duration: number) => {
        if (duration <= 4.5) return {
            bg: "bg-red-500/10",
            border: "border-red-500/20",
            text: "text-red-400",
            iconBg: "bg-red-500/20",
            status: "매우 부족해요"
        };
        if (duration <= 6.5) return {
            bg: "bg-yellow-500/10",
            border: "border-yellow-500/20",
            text: "text-yellow-400",
            iconBg: "bg-yellow-500/20",
            status: "약간 부족해요"
        };
        return {
            bg: "bg-purple-600/10",
            border: "border-purple-500/20",
            text: "text-purple-400",
            iconBg: "bg-purple-500/20",
            status: sleepRecord?.quality === 4 ? '꿀잠 잤어요!' : sleepRecord?.quality === 3 ? '적당히 잤어요' : '피곤한 하루였어요'
        };
    };

    const sleepStyle = sleepRecord ? getSleepColorStub(sleepRecord.duration) : null;

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <header className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all border border-white/10"
                >
                    <ArrowLeft className="w-5 h-5 text-white/60" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        {format(targetDate, 'yyyy년 M월 d일', { locale: ko })}
                    </h1>
                    <p className="text-sm text-white/40">{format(targetDate, 'EEEE', { locale: ko })} 기록</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* [LEFT] Sleep Section */}
                <div className="space-y-6">
                    <div className="glass p-8 space-y-8 border-purple-500/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Moon className="w-24 h-24" />
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                                <Moon className="w-5 h-5 text-purple-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white">수면 정보</h2>
                        </div>

                        {sleepRecord ? (
                            <div className="space-y-8">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                                        <div className="flex items-center gap-2 mb-2 text-white/40">
                                            <Moon className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold uppercase tracking-wider">취침 시간</span>
                                        </div>
                                        <div className="text-2xl font-black text-white">
                                            {sleepRecord.bedTime && !isNaN(new Date(sleepRecord.bedTime).getTime())
                                                ? format(new Date(sleepRecord.bedTime), 'a hh:mm', { locale: ko })
                                                : '--:--'}
                                        </div>
                                    </div>
                                    <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                                        <div className="flex items-center gap-2 mb-2 text-white/40">
                                            <Sun className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold uppercase tracking-wider">기상 시간</span>
                                        </div>
                                        <div className="text-2xl font-black text-white">
                                            {sleepRecord.wakeTime && !isNaN(new Date(sleepRecord.wakeTime).getTime())
                                                ? format(new Date(sleepRecord.wakeTime), 'a hh:mm', { locale: ko })
                                                : '--:--'}
                                        </div>
                                    </div>
                                </div>

                                <div className={`${sleepStyle?.bg} rounded-3xl p-8 border ${sleepStyle?.border} flex flex-col items-center text-center transition-colors duration-300`}>
                                    <div className={`text-sm font-bold ${sleepStyle?.text} mb-2`}>총 수면 시간</div>
                                    <div className="text-6xl font-black text-white mb-4">
                                        {sleepRecord.duration}<span className="text-xl font-normal text-white/40 ml-1">h</span>
                                    </div>
                                    <div className={`flex items-center gap-2 px-4 py-2 ${sleepStyle?.iconBg} rounded-full`}>
                                        <CheckCircle2 className={`w-4 h-4 ${sleepStyle?.text}`} />
                                        <span className={`text-xs font-bold ${sleepStyle?.text}`}>
                                            {sleepStyle?.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-64 flex flex-col items-center justify-center text-white/20 border-2 border-dashed border-white/5 rounded-3xl">
                                <p className="text-lg">수면 기록이 없습니다</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* [RIGHT] Exercise Section (Future) */}
                <div className="space-y-6">
                    <div className="glass p-8 space-y-6 border-blue-500/20 relative overflow-hidden h-full">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Dumbbell className="w-24 h-24" />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                    <Dumbbell className="w-5 h-5 text-blue-400" />
                                </div>
                                <h2 className="text-xl font-bold text-white">운동 정보</h2>
                            </div>
                            {dailyExercises.length > 0 && (
                                <div className="px-3 py-1 bg-blue-500/20 rounded-lg border border-blue-500/20 text-xs font-bold text-blue-400">
                                    {dailyExercises.length} Records
                                </div>
                            )}
                        </div>

                        {dailyExercises.length > 0 ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 rounded-2xl p-5 border border-white/5 text-center">
                                        <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Total Time</div>
                                        <div className="text-2xl font-black text-white">
                                            {dailyExercises.reduce((acc, curr) => acc + curr.duration, 0)}
                                            <span className="text-xs text-white/40 ml-1">min</span>
                                        </div>
                                    </div>
                                    {/* Streak / Gap Card Replaced */}
                                    <div className={`rounded-2xl p-5 border text-center flex flex-col items-center justify-center relative overflow-hidden ${streakStatus.type === 'streak' ? 'bg-orange-500/10 border-orange-500/20' : 'bg-white/5 border-white/5'}`}>
                                        {streakStatus.type === 'streak' ? (
                                            <>
                                                {streakStatus.count >= 3 && (
                                                    <div className="absolute top-0 right-0 p-2 opacity-10">
                                                        <Flame className="w-12 h-12 text-orange-500" />
                                                    </div>
                                                )}
                                                <div className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                    <Flame className="w-3 h-3" /> Streak
                                                </div>
                                                <div className="text-2xl font-black text-white">
                                                    {streakStatus.count}
                                                    <span className="text-xs text-white/40 ml-1">days</span>
                                                </div>
                                                {streakStatus.count >= 3 && (
                                                    <div className="text-[10px] font-bold text-orange-400 mt-1 animate-pulse">
                                                        폼 미쳤다! 🔥
                                                    </div>
                                                )}
                                            </>
                                        ) : streakStatus.type === 'gap' ? (
                                            <>
                                                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 flex items-center gap-1 justify-center">
                                                    <CalendarDays className="w-3 h-3" /> Interval
                                                </div>
                                                <div className="text-xl font-bold text-white">
                                                    {streakStatus.count}일 만에
                                                </div>
                                                {streakStatus.count >= 3 && (
                                                    <div className="text-[10px] font-bold text-white/40 mt-1">
                                                        너무 오래 쉬었어요 🥲
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">First Record</div>
                                                <div className="text-lg font-bold text-white">
                                                    첫 시작! 🎉
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                    {dailyExercises.map((ex, idx) => {
                                        const isWeight = ex.type === '웨이트';
                                        const isRunning = ex.type === '런닝';
                                        const isCardio = ex.type === '유산소';

                                        return (
                                            <div key={ex.id || idx} className="bg-white/5 rounded-2xl p-5 border border-white/5 hover:bg-white/10 transition-colors relative group">
                                                {/* Header & Main Stat */}
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="space-y-1">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${isRunning ? 'bg-blue-500/20 text-blue-400' :
                                                            isCardio ? 'bg-orange-500/20 text-orange-400' :
                                                                'bg-emerald-500/20 text-emerald-400'
                                                            }`}>
                                                            {ex.type}
                                                        </span>
                                                        {/* Weight: Show Subtypes as Main Title */}
                                                        {isWeight && ex.subTypes && ex.subTypes.length > 0 && (
                                                            <div className="text-lg font-black text-white leading-tight">
                                                                {ex.subTypes.join(', ')}
                                                            </div>
                                                        )}
                                                        {/* Cardio: Show Subtype (Machine) */}
                                                        {isCardio && ex.subTypes && ex.subTypes.length > 0 && (
                                                            <div className="text-base font-bold text-white leading-tight">
                                                                {ex.subTypes[0]}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Right Side Main Stat */}
                                                    <div className="text-right">
                                                        {isRunning && ex.distance ? (
                                                            <div className="text-2xl font-black text-white">{ex.distance}<span className="text-sm text-white/40 ml-1">km</span></div>
                                                        ) : isCardio ? (
                                                            <div className="text-2xl font-black text-orange-400">{ex.calories}<span className="text-sm text-orange-400/60 ml-1">kcal</span></div>
                                                        ) : (
                                                            <div className="text-xl font-black text-white">{ex.duration}<span className="text-xs text-white/40 ml-1">min</span></div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Secondary Details */}
                                                <div className="flex items-center gap-3 text-xs text-white/40 font-medium mt-2">
                                                    {isRunning ? (
                                                        <>
                                                            {ex.pace && <span className="text-blue-400 font-bold">Pace {ex.pace}</span>}
                                                            <span className="w-1 h-1 rounded-full bg-white/20" />
                                                            <span>{ex.duration} min</span>
                                                            <span className="w-1 h-1 rounded-full bg-white/20" />
                                                            <span>{ex.calories} kcal</span>
                                                        </>
                                                    ) : isCardio ? (
                                                        <span>{ex.duration} min 동안 수행</span>
                                                    ) : (
                                                        // Weight
                                                        <span>{ex.calories} kcal 소모</span>
                                                    )}
                                                </div>

                                                {/* Notes */}
                                                {ex.notes && (
                                                    <div className={`mt-3 pt-3 border-t border-white/5 ${isWeight ? 'text-white/80' : 'text-white/40'} text-xs flex items-start gap-2`}>
                                                        <div className={`mt-1 min-w-[2px] h-2.5 rounded-full ${isWeight ? 'bg-emerald-500' : 'bg-white/20'}`} />
                                                        "{ex.notes}"
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="h-64 flex flex-col items-center justify-center text-white/20 border-2 border-dashed border-white/5 rounded-3xl">
                                <p className="text-lg font-bold">운동 기록이 없습니다</p>
                                <p className="text-xs text-white/10 mt-2">오늘도 활기찬 하루 보내세요!</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* [BOTTOM] Meal & Reading Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Meal Section */}
                <div className="glass p-8 space-y-6 border-orange-500/20 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                                <Utensils className="w-5 h-5 text-orange-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white">식단 정보</h2>
                        </div>
                        {dailyMeals.length > 0 && (
                            <div className="px-3 py-1 bg-orange-500/20 rounded-lg border border-orange-500/20 text-xs font-bold text-orange-400">
                                {dailyMeals.length} Meals
                            </div>
                        )}
                    </div>

                    {dailyMeals.length > 0 ? (
                        <div className="space-y-4">
                            {dailyMeals.map((meal, idx) => (
                                <div key={idx} className="bg-white/5 rounded-2xl p-5 border border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/10 uppercase font-black text-orange-400 text-xs">
                                            {meal.type}
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold text-white leading-tight">{meal.menu}</div>
                                            <div className="text-xs text-white/40 mt-1">{meal.time}</div>
                                        </div>
                                    </div>
                                    {meal.calories && (
                                        <div className="text-right">
                                            <div className="text-lg font-black text-white">{meal.calories}</div>
                                            <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest">KCAL</div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-48 flex flex-col items-center justify-center text-white/20 border-2 border-dashed border-white/5 rounded-3xl">
                            <p className="text-lg font-bold">식단 기록이 없습니다</p>
                        </div>
                    )}
                </div>

                {/* Reading Section */}
                <div className="glass p-8 space-y-6 border-blue-500/20 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-blue-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white">독서 정보</h2>
                        </div>
                        {dailyReading.length > 0 && (
                            <div className="px-3 py-1 bg-blue-500/20 rounded-lg border border-blue-500/20 text-xs font-bold text-blue-400">
                                {dailyReading.length} Sessions
                            </div>
                        )}
                    </div>

                    {dailyReading.length > 0 ? (
                        <div className="space-y-4">
                            <div className="bg-blue-500/10 rounded-2xl p-6 border border-blue-500/20 flex flex-col items-center justify-center text-center">
                                <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Total Pages Read</div>
                                <div className="text-5xl font-black text-white">
                                    {dailyReading.reduce((acc, cur) => acc + (cur.amount || 0), 0)}
                                    <span className="text-xl font-normal text-white/40 ml-1">pages</span>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {dailyReading.map((session, idx) => (
                                    <div key={idx} className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                                                <Timer className="w-4 h-4 text-blue-400" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white">{session.bookTitle}</div>
                                                <div className="text-[10px] text-white/40">{session.time}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-black text-white">{session.amount}p</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-48 flex flex-col items-center justify-center text-white/20 border-2 border-dashed border-white/5 rounded-3xl">
                            <p className="text-lg font-bold">독서 기록이 없습니다</p>
                        </div>
                    )}
                </div>
            </div>

            {/* [BOTTOM] Daily Diary Section */}
            <div className="glass p-8 space-y-6 border-yellow-500/20 relative overflow-hidden">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-yellow-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">하루 기록 (Diary)</h2>
                </div>

                {dailyDiary ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                        <div className="bg-white/5 rounded-3xl p-6 border border-white/5 flex flex-col items-center justify-center text-center space-y-3">
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">오늘의 기분</span>
                            <div className="flex gap-1">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className={`w-5 h-5 ${i < dailyDiary.score ? 'text-yellow-400 fill-current' : 'text-white/10'}`} />
                                ))}
                            </div>
                            <span className="text-2xl font-black text-white">{dailyDiary.score}.0</span>
                        </div>
                        <div className="md:col-span-2 bg-yellow-400/5 rounded-3xl p-8 border border-yellow-400/10 min-h-[160px]">
                            <p className="text-lg font-medium text-white/90 leading-relaxed">
                                "{dailyDiary.diary || "기록된 내용이 없습니다."}"
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="h-32 flex flex-col items-center justify-center text-white/20 border-2 border-dashed border-white/5 rounded-3xl">
                        <p className="text-lg font-bold">작성된 하루 기록이 없습니다</p>
                    </div>
                )}
            </div>
        </div>
    );
}

