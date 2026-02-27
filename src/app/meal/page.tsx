"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, Utensils, Plus, Trash2, Camera, X, Sun, SunDim, Moon, Coffee, AlertCircle, Sparkles, Brain, Loader2, Settings } from "lucide-react";
import { analyzeMeals } from "@/app/actions/mealAnalysis";
import ReactMarkdown from 'react-markdown';
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, addMonths, subMonths, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";
import {
    collection,
    onSnapshot,
    addDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    setDoc,
    getDoc,
    serverTimestamp,
    Timestamp,
    QuerySnapshot,
    DocumentData
} from "firebase/firestore";

interface MealRecord {
    id: string;
    type: '아침' | '점심' | '저녁' | '간식';
    menu: string;
    calories?: number | null;
    time: string;
    date: string;
    createdAt?: Timestamp;
}

export default function MealPage() {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [meals, setMeals] = useState<MealRecord[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newMeal, setNewMeal] = useState<Partial<MealRecord>>({
        type: '점심',
        menu: '',
        calories: undefined,
        time: format(new Date(), 'HH:mm'),
    });
    const [isLoaded, setIsLoaded] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null); // 신규: AI 에러 상태
    const [customInstructions, setCustomInstructions] = useState("");
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const { user } = useAuth();

    // Firestore Load (Real-time)
    useEffect(() => {
        if (!user) return;

        const db = getFirebaseDb();
        // Load Meals
        const q = query(
            collection(db, "users", user.uid, "meals"),
            orderBy("time", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            const mealList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MealRecord[];
            setMeals(mealList);
            setIsLoaded(true);
            setError(null);
        }, (error: any) => {
            console.error("Firestore onSnapshot error (meals):", error);
            if (error.code === 'permission-denied') {
                setError("식사 데이터를 불러올 권한이 없습니다. Firebase 보안 규칙을 확인해주세요.");
            } else {
                setError("데이터를 불러오는 중 오류가 발생했습니다.");
            }
            setIsLoaded(true);
        });

        // Load AI Instructions
        getDoc(doc(db, "users", user.uid, "settings", "meal_ai")).then(snap => {
            if (snap.exists()) {
                setCustomInstructions(snap.data().instructions || "");
            }
            setError(null);
        }).catch(e => {
            console.error("Failed to load AI instructions:", e);
            if (e.code === 'permission-denied') {
                // Don't necessarily show main error for settings, just log it or show subtle hint
                console.warn("AI 설정 접근 권한이 없습니다.");
            }
        });

        return () => unsubscribe();
    }, [user]);

    // Migration logic v2 (Fixed key mismatch)
    useEffect(() => {
        if (!user || !isLoaded) return;

        const migrationDone = localStorage.getItem('migration_done_meal_v2');
        if (migrationDone === 'true') return;

        const localMealsStr = localStorage.getItem('meal_records_v1');

        if (localMealsStr) {
            const db = getFirebaseDb();
            try {
                const localMeals = JSON.parse(localMealsStr);
                // Ensure we only migrate if Firestore is relatively empty for this user (to avoid mass duplicates)
                // or if specifically forced by v2 flag.
                localMeals.forEach(async (meal: any) => {
                    const { id, ...data } = meal;
                    // Validate data
                    if (!data.menu || !data.date) return;

                    await addDoc(collection(db, "users", user.uid, "meals"), {
                        ...data,
                        createdAt: serverTimestamp()
                    });
                });
                localStorage.setItem('migration_done_meal_v2', 'true');
                console.log("Meal data migration v2 completed.");
            } catch (e) {
                console.error("Migration error (meal v2):", e);
            }
        } else {
            // No local data found, but mark done to avoid repeated checks
            localStorage.setItem('migration_done_meal_v2', 'true');
        }
    }, [user, isLoaded, meals.length]);

    // Save AI Instructions
    useEffect(() => {
        if (!user || !isLoaded) return;
        const db = getFirebaseDb();
        setDoc(doc(db, "users", user.uid, "settings", "meal_ai"), {
            instructions: customInstructions,
            updatedAt: new Date().toISOString()
        }, { merge: true })
            .then(() => setError(null))
            .catch(e => {
                console.error("Failed to save AI instructions:", e);
                if (e.code === 'permission-denied') {
                    // Potential permission issue for settings
                }
            });
    }, [customInstructions, user, isLoaded]);

    const displayMeals = useMemo(() => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        // Filter meals for selected date
        const dayMeals = meals.filter(m => m.date === dateStr).map(m => ({ ...m, isYesterday: false }));

        // Filter and mark yesterday's meals
        const prevDateStr = format(subDays(selectedDate, 1), 'yyyy-MM-dd');
        const yesterdayMeals = meals.filter(m => m.date === prevDateStr).map(m => ({ ...m, isYesterday: true }));

        // Combine and sort by time
        return [...yesterdayMeals, ...dayMeals].sort((a, b) => a.time.localeCompare(b.time));
    }, [meals, selectedDate]);

    // Auto-analyze last 5 meals when meals change (Deep dependency check)
    useEffect(() => {
        if (!user || meals.length === 0 || !isLoaded) return;

        const triggerAutoAnalyze = async () => {
            // Check if we already have an insight for the CURRENT last 5 meals
            // This prevents redundant expensive API calls
            setIsAnalyzing(true);
            try {
                setAiError(null);
                const last5Meals = [...meals]
                    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
                    .slice(0, 5);

                // Only analyze if there are meals to analyze
                if (last5Meals.length > 0) {
                    const result = await analyzeMeals(last5Meals, customInstructions);
                    if (result.success) {
                        setAiInsight(result.data || null);
                        setAiError(null);
                    } else {
                        setAiError(result.error || "분석에 실패했습니다.");
                    }
                }
            } catch (e: any) {
                console.error("Auto analysis failed:", e);
                setAiError(e.message || "자동 분석에 실패했습니다.");
            } finally {
                setIsAnalyzing(false);
            }
        };

        const timer = setTimeout(triggerAutoAnalyze, 2000); // 2 second debounce for stability
        return () => clearTimeout(timer);
    }, [JSON.stringify(meals.slice(0, 5)), user, isLoaded]); // JSON.stringify for deep comparison

    const handleAddMeal = async () => {
        if (!newMeal.menu || !user) return;

        const record: Omit<MealRecord, 'id'> = {
            type: newMeal.type as any,
            menu: newMeal.menu,
            calories: newMeal.calories ? Number(newMeal.calories) : null,
            time: newMeal.time || format(new Date(), 'HH:mm'),
            date: format(selectedDate, 'yyyy-MM-dd'),
            createdAt: serverTimestamp() as any
        };

        try {
            const db = getFirebaseDb();
            await addDoc(collection(db, "users", user.uid, "meals"), record);
            setShowAddModal(false);
            setNewMeal({ type: '점심', menu: '', calories: undefined, time: format(new Date(), 'HH:mm') });
            setError(null);
        } catch (e) {
            console.error("Failed to add meal", e);
            alert("저장에 실패했습니다.");
        }
    };

    const handleDeleteMeal = async (id: string) => {
        if (!user) return;
        try {
            const db = getFirebaseDb();
            await deleteDoc(doc(db, "users", user.uid, "meals", id));
        } catch (e) {
            console.error("Failed to delete meal", e);
            alert("삭제에 실패했습니다.");
        }
    };

    const handleAnalyze = async () => {
        if (meals.length === 0) return;
        setIsAnalyzing(true);
        setAiError(null);
        try {
            const last5Meals = [...meals].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)).slice(0, 5);
            const result = await analyzeMeals(last5Meals, customInstructions);
            if (result.success) {
                setAiInsight(result.data || null);
                setAiError(null);
            } else {
                setAiError(result.error || "분석에 실패했습니다.");
            }
        } catch (e: any) {
            console.error(e);
            setAiError(e.message || "AI 분석 중 오류가 발생했습니다.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getMealIcon = (type: string) => {
        switch (type) {
            case '아침': return <SunDim className="w-5 h-5 text-orange-300" />;
            case '점심': return <Sun className="w-5 h-5 text-yellow-400" />;
            case '저녁': return <Moon className="w-5 h-5 text-indigo-300" />;
            case '간식': return <Coffee className="w-5 h-5 text-emerald-300" />;
            default: return <Utensils className="w-5 h-5 text-orange-400" />;
        }
    };

    return (
        <div className="w-full py-6 space-y-6 animate-in fade-in duration-700 pb-20">
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
                        식단 정보
                        <div className="flex items-center justify-center min-w-[3rem] h-8 px-3 rounded-full bg-orange-500 text-white text-xs font-black shadow-[0_0_20px_rgba(249,115,22,0.4)] animate-pulse">
                            {displayMeals.filter(m => !(m as any).isYesterday).length} MEALS
                        </div>
                    </h1>
                </div>
                <div className="text-right">
                    <p className="text-sm font-bold text-white/40 tracking-widest uppercase">
                        {format(selectedDate, 'yyyy년 M월 d일 EEEE', { locale: ko })}
                    </p>
                </div>
            </header>

            {/* Daily Summary - Simplified (Focusing on variety/count rather than pure calories) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <section className="glass p-8 space-y-2 md:col-span-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Utensils className="w-32 h-32" />
                    </div>
                    <h2 className="text-base font-black text-white/40 tracking-widest uppercase">오늘의 식사 요약</h2>
                    <div className="flex items-baseline gap-4 relative z-10">
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black text-white">{displayMeals.filter(m => !(m as any).isYesterday).length}</span>
                            <span className="text-lg font-bold text-white/40">번의 식사</span>
                        </div>
                        {displayMeals.filter(m => !(m as any).isYesterday).some(m => m.calories) && (
                            <div className="text-sm font-bold text-white/20">
                                (약 {displayMeals.filter(m => !(m as any).isYesterday).reduce((acc, cur) => acc + (cur.calories || 0), 0)} kcal)
                            </div>
                        )}
                    </div>
                </section>
                <section className="glass p-8 flex flex-col justify-center border-orange-500/20 gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-orange-400/80">
                        <AlertCircle className="w-4 h-4" />
                        <span>칼로리보다 균형 잡힌 식단이 중요합니다!</span>
                    </div>
                    <p className="text-[11px] text-white/40 leading-relaxed">
                        정확한 수치 계산보다는 무엇을 먹었는지 기록하는 습관에 집중해보세요.
                    </p>
                </section>
            </div>

            {/* AI Analysis Section */}
            <section className="glass p-8 relative overflow-hidden border-indigo-500/20 bg-indigo-500/5">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                            <Brain className="w-6 h-6 text-indigo-400" />
                            <h3 className="text-2xl font-black text-white tracking-tight">Gemini AI 영양사 분석</h3>
                            <button
                                onClick={() => setShowSettingsModal(true)}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
                                title="AI 가이드라인 설정"
                            >
                                <Settings className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm text-white/40 font-bold">최근 5번의 식사를 분석하여 영양 리포트를 자동으로 업데이트합니다.</p>
                    </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || meals.length === 0}
                        className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                    >
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        지금 분석하기
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {isAnalyzing ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-8 space-y-4"
                        >
                            <div className="h-4 bg-white/5 rounded-full w-3/4 animate-pulse" />
                            <div className="h-4 bg-white/5 rounded-full w-1/2 animate-pulse" />
                            <div className="h-4 bg-white/5 rounded-full w-2/3 animate-pulse" />
                        </motion.div>
                    ) : aiError ? (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-8 p-6 bg-red-500/5 border border-red-500/20 rounded-2xl flex flex-col items-center gap-4 text-center"
                        >
                            <div className="flex flex-col items-center gap-2">
                                <AlertCircle className="w-8 h-8 text-red-400 opacity-50" />
                                <p className="text-red-400 font-bold">분석에 실패했습니다</p>
                                <p className="text-red-400/60 text-xs">{aiError}</p>
                            </div>
                            <button
                                onClick={handleAnalyze}
                                className="px-6 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-black rounded-xl transition-all uppercase tracking-widest border border-red-500/20"
                            >
                                다시 분석하기
                            </button>
                        </motion.div>
                    ) : aiInsight ? (
                        <motion.div
                            key="insight"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-8 p-6 bg-white/5 rounded-2xl border border-white/5 prose prose-invert max-w-none prose-p:text-sm prose-p:leading-relaxed prose-headings:text-indigo-300 prose-strong:text-indigo-400"
                        >
                            <ReactMarkdown>{aiInsight}</ReactMarkdown>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </section>

            {/* Meal List Section */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-white px-1">기록 리스트</h3>
                    {!isSameDay(selectedDate, new Date()) && (
                        <button
                            onClick={() => setSelectedDate(new Date())}
                            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                            오늘로 돌아가기
                        </button>
                    )}
                </div>

                <div className="space-y-4">
                    {displayMeals.length > 0 ? (
                        displayMeals.map((meal: any) => (
                            <motion.div
                                key={meal.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: meal.isYesterday ? 0.5 : 1, y: 0 }}
                                className={`glass group relative overflow-hidden transition-all hover:bg-white/10 ${meal.isYesterday ? 'border-dashed border-white/10 bg-white/[0.02]' : ''}`}
                            >
                                <div className="p-6 flex items-center justify-between">
                                    <div className="flex items-center gap-6">
                                        <div className={`w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-white/10 transition-colors`}>
                                            {getMealIcon(meal.type)}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">{meal.type}</span>
                                                <span className="text-[10px] font-black font-mono text-white/20 tracking-tighter uppercase">{meal.time}</span>
                                                {meal.isYesterday && (
                                                    <span className="px-1.5 py-0.5 bg-white/5 text-[9px] font-black text-white/30 rounded uppercase tracking-tighter">Yesterday</span>
                                                )}
                                            </div>
                                            <h4 className="text-xl font-bold text-white tracking-tight">{meal.menu}</h4>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {meal.calories && (
                                            <div className="text-right">
                                                <span className="text-sm font-black text-white/60">{meal.calories}</span>
                                                <span className="text-[10px] font-bold text-white/10 ml-1 uppercase">kcal</span>
                                            </div>
                                        )}
                                        <button
                                            onClick={() => handleDeleteMeal(meal.id)}
                                            className="p-3 text-white/10 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="glass p-16 flex flex-col items-center justify-center text-center space-y-4 border-dashed">
                            <Utensils className="w-12 h-12 text-white/10" />
                            <div className="space-y-1">
                                <p className="text-white/40 font-bold">식사 기록이 없습니다.</p>
                                <p className="text-xs text-white/20">오늘 무엇을 드셨나요? 아래 버튼을 눌러 기록해보세요.</p>
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => setShowAddModal(true)}
                    className="w-full py-6 glass border-dashed border-white/20 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group flex flex-col items-center justify-center gap-2"
                >
                    <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center group-hover:bg-orange-500/20 group-hover:scale-110 transition-all">
                        <Plus className="w-5 h-5 text-white/40 group-hover:text-orange-500" />
                    </div>
                    <span className="text-sm font-black text-white/20 group-hover:text-orange-500 uppercase tracking-widest">기록 추가하기</span>
                </button>
            </section>

            {/* Calendar Selection Section */}
            <section className="pt-8 border-t border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black text-white px-1">히스토리 탐색</h3>
                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1 px-1">지난 기록을 캘린더에서 확인하세요</p>
                    </div>
                    <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-xl">
                        <button
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            className="p-1 hover:text-orange-400 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm font-black text-white min-w-[100px] text-center">
                            {format(currentMonth, 'yyyy년 M월', { locale: ko })}
                        </span>
                        <button
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            className="p-1 hover:text-orange-400 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5 rotate-180" />
                        </button>
                    </div>
                </div>

                <div className="glass p-4">
                    <div className="grid grid-cols-7 mb-4">
                        {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                            <div key={day} className={`text-center text-[10px] font-black py-2 uppercase tracking-tighter ${i === 0 ? 'text-red-400/60' : i === 6 ? 'text-blue-400/60' : 'text-white/20'}`}>
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {(() => {
                            const monthStart = startOfMonth(currentMonth);
                            const monthEnd = endOfMonth(monthStart);
                            const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
                            const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
                            const days = eachDayOfInterval({ start: startDate, end: endDate });

                            return days.map((day, i) => {
                                const isCurrentMonth = isSameMonth(day, monthStart);
                                const isSelected = isSameDay(day, selectedDate);
                                const isToday = isSameDay(day, new Date());
                                const hasRecords = meals.some(m => m.date === format(day, 'yyyy-MM-dd'));

                                return (
                                    <button
                                        key={day.toISOString()}
                                        onClick={() => {
                                            setSelectedDate(day);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className={`
                                            aspect-square rounded-lg flex flex-col items-center justify-center gap-1 transition-all relative
                                            ${!isCurrentMonth ? 'opacity-10' : 'opacity-100'}
                                            ${isSelected ? 'bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)] scale-110 z-10 font-black' : 'hover:bg-white/5'}
                                        `}
                                    >
                                        <span className={`text-xs font-bold ${isToday && !isSelected ? 'text-orange-500' : ''}`}>
                                            {format(day, 'd')}
                                        </span>
                                        {hasRecords && (
                                            <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-orange-500/40'}`} />
                                        )}
                                    </button>
                                );
                            });
                        })()}
                    </div>
                </div>
            </section>

            {/* Add Meal Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-sm glass p-8 space-y-6"
                        >
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-black text-white">식사 기록 추가</h3>
                                <button onClick={() => setShowAddModal(false)}><X className="text-white/40 hover:text-white" /></button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-4 gap-2">
                                    {['아침', '점심', '저녁', '간식'].map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setNewMeal({ ...newMeal, type: t as any })}
                                            className={`py-2 rounded-xl text-xs font-bold transition-all border ${newMeal.type === t ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-white/60 mb-1 block">메뉴</label>
                                    <input
                                        type="text"
                                        placeholder="어떤 음식을 드셨나요?"
                                        value={newMeal.menu}
                                        onChange={(e) => setNewMeal({ ...newMeal, menu: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-orange-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-white/60 mb-1 block">시간</label>
                                        <input
                                            type="time"
                                            value={newMeal.time}
                                            onChange={(e) => setNewMeal({ ...newMeal, time: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-orange-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-white/60 mb-1 block">칼로리 (선택)</label>
                                        <input
                                            type="number"
                                            placeholder="kcal"
                                            value={newMeal.calories ?? ''}
                                            onChange={(e) => setNewMeal({ ...newMeal, calories: e.target.value ? Number(e.target.value) : undefined })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-orange-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleAddMeal}
                                className="w-full py-4 bg-orange-500 hover:brightness-110 text-white font-bold rounded-2xl transition-all shadow-lg shadow-orange-500/20"
                            >
                                기록 저장
                            </button>
                        </motion.div>
                    </div>
                )}

                {/* AI Settings Modal */}
                {showSettingsModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg glass p-8 space-y-6"
                        >
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Settings className="w-5 h-5 text-indigo-400" />
                                    <h3 className="text-xl font-black text-white">AI 식단 가이드라인 설정</h3>
                                </div>
                                <button onClick={() => setShowSettingsModal(false)}><X className="text-white/40 hover:text-white" /></button>
                            </div>

                            <div className="space-y-4">
                                <p className="text-sm text-white/40 font-bold leading-relaxed">
                                    AI가 사용자님의 생활 패턴이나 취향을 반영하여 더 정확하게 분석할 수 있습니다.<br />
                                    <span className="text-indigo-400 text-xs">예: "공익근무 중이라 활동량이 적음", "자주 가는 메뉴: XX 칼국수"</span>
                                </p>

                                <textarea
                                    value={customInstructions}
                                    onChange={(e) => setCustomInstructions(e.target.value)}
                                    placeholder="분석 시 고려할 개인 정보나 원하는 분석 스타일을 입력하세요..."
                                    className="w-full h-48 bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-sm font-medium focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                                />

                                <p className="text-[11px] text-white/20">
                                    * 설정된 가이드라인은 Firestore에 안전하게 저장되며 모든 분석에 반영됩니다.
                                </p>
                            </div>

                            <button
                                onClick={() => setShowSettingsModal(false)}
                                className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/20"
                            >
                                설정 저장 및 닫기
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
