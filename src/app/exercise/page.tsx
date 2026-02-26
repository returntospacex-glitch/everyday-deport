"use client";

import {
    Dumbbell,
    Timer,
    Flame,
    ChevronLeft,
    ChevronRight,
    Plus,
    Calendar as CalendarIcon,
    TrendingUp,
    CheckCircle2,
    Clock,
    Activity,
    Target,
    Zap,
    RotateCcw,
    X,
    Rocket,
    FileText,
    ArrowUpRight,
    ArrowDownRight,
    Trophy,
    MapPin,
    Navigation,
    Minus,
    Scale,
    BicepsFlexed,
    Save,
    Trash2,
    TrendingDown,
    History as HistoryIcon,
    List,
    Maximize2,
    ChevronDown,
    ArrowRight,
    TrendingDown as TrendingDownIcon, // Added TrendingDown as TrendingDownIcon
    PersonStanding
} from "lucide-react";
import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameDay,
    isSameMonth,
    startOfWeek,
    endOfWeek,
    addDays,
    subDays,
    getDaysInMonth,
    getDate,
    eachWeekOfInterval,
    isWithinInterval,
    differenceInDays
} from "date-fns";
import { ko } from "date-fns/locale";
import {
    exerciseRecords,
    ExerciseType,
    getExerciseAdvancedStats,
    getMonthlyExerciseStats,
    ExerciseRecord,
    mergeExerciseRecords,
    BodyMetricGoal
} from "@/lib/exerciseData"; // BodyMetricGoal import 추가
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    LabelList
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, Timestamp, getDoc, QuerySnapshot, DocumentData, QueryDocumentSnapshot, DocumentSnapshot, serverTimestamp } from "firebase/firestore"; // Recharts import 추가

export default function ExercisePage() {
    const { user } = useAuth();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [records, setRecords] = useState<ExerciseRecord[]>([]);
    const [isSaved, setIsSaved] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);

    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'WORKOUT' | 'BODY'>('WORKOUT');
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    // Goals (Firestore)
    const [goals, setGoals] = useState({
        gym: 2,
        running: 1,
        monthlyTarget: 16
    });

    // Body Metrics (Firestore)
    const [bodyMetrics, setBodyMetrics] = useState({
        weight: "",
        muscleMass: "",
        bodyFat: "",
        fatMass: ""
    });
    const [savedBodyMetrics, setSavedBodyMetrics] = useState<any[]>([]);

    // Body Metric Goals (Firestore)
    const [bodyGoals, setBodyGoals] = useState<any>({
        targetWeight: 0,
        targetMuscleMass: 0,
        targetBodyFat: 0,
        deadline: null,
        startDate: null
    });
    const [showBodyGoalModal, setShowBodyGoalModal] = useState(false);


    // Load All Data from Firestore (Real-time)
    useEffect(() => {
        if (!user) return;
        const db = getFirebaseDb();

        // 1. Exercise Records
        const exerciseQ = query(collection(db, "users", user.uid, "exercises"));
        const unsubExercise = onSnapshot(exerciseQ, (snapshot: QuerySnapshot<DocumentData>) => {
            const loaded = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
                const data = doc.data();
                return {
                    ...data,
                    date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date),
                } as ExerciseRecord;
            });
            // Sort by date (descending for history view mostly or handled by UI)
            // But main view needs consistent sorting
            setRecords(loaded.sort((a: ExerciseRecord, b: ExerciseRecord) => b.date.getTime() - a.date.getTime()));
        });

        // 2. Body Metrics
        const metricsQ = query(collection(db, "users", user.uid, "bodyMetrics"));
        const unsubMetrics = onSnapshot(metricsQ, (snapshot: QuerySnapshot<DocumentData>) => {
            const loaded = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
                const data = doc.data();
                return {
                    ...data,
                    date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date),
                };
            });
            // Sort by date ascending
            loaded.sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
            setSavedBodyMetrics(loaded);

            // Set latest to input
            if (loaded.length > 0) {
                const latest = loaded[loaded.length - 1];
                setBodyMetrics({
                    weight: latest.weight.toString(),
                    muscleMass: (latest.muscleMass || "").toString(),
                    bodyFat: (latest.bodyFat || "").toString(),
                    fatMass: (latest.fatMass || "").toString()
                });
            }
        });

        // 3. User Settings (Goals)
        const settingsRef = doc(db, "users", user.uid, "settings", "exercise");
        const unsubSettings = onSnapshot(settingsRef, (doc: DocumentSnapshot<DocumentData>) => {
            if (doc.exists()) {
                const data = doc.data();
                if (data.goals) setGoals(data.goals);
                if (data.bodyGoals) setBodyGoals(data.bodyGoals);
            }
        });

        return () => {
            unsubExercise();
            unsubMetrics();
            unsubSettings();
        };
    }, [user]);

    // Migration logic
    useEffect(() => {
        if (!user || !isSaved) return; // isSaved is not the right flag, using isLoaded if exists? 
        // Wait, ExercisePage doesn't have isLoaded. I'll use records.length.
    }, [user]);

    // Correcting migration logic for Exercise
    useEffect(() => {
        if (!user) return;

        const migrationDone = localStorage.getItem('migration_done_exercise');
        if (migrationDone === 'true') return;

        const localExercisesStr = localStorage.getItem('exercise_records_v1');
        const localMetricsStr = localStorage.getItem('body_metrics_v1');

        if (localExercisesStr || localMetricsStr) {
            const db = getFirebaseDb();

            if (localExercisesStr) {
                try {
                    const localExercises = JSON.parse(localExercisesStr);
                    localExercises.forEach(async (ex: any) => {
                        const { id, date, ...data } = ex;
                        await setDoc(doc(db, "users", user.uid, "exercises", id || Date.now().toString()), {
                            ...data,
                            date: Timestamp.fromDate(new Date(date)),
                            createdAt: serverTimestamp()
                        });
                    });
                } catch (e) { console.error("Migration error (exercise):", e); }
            }

            if (localMetricsStr) {
                try {
                    const localMetrics = JSON.parse(localMetricsStr);
                    localMetrics.forEach(async (m: any) => {
                        const { id, date, ...data } = m;
                        await setDoc(doc(db, "users", user.uid, "bodyMetrics", id || Date.now().toString()), {
                            ...data,
                            date: Timestamp.fromDate(new Date(date)),
                            createdAt: serverTimestamp()
                        });
                    });
                } catch (e) { console.error("Migration error (metrics):", e); }
            }

            localStorage.setItem('migration_done_exercise', 'true');
            console.log("Exercise data migration completed.");
        }
    }, [user]);

    // Auto-calculate Target Weight (Client-side logic remains same)
    useEffect(() => {
        const fatMass = parseFloat(String(bodyGoals.targetFatMass));
        const bodyFat = parseFloat(String(bodyGoals.targetBodyFat));

        if (!isNaN(fatMass) && !isNaN(bodyFat) && bodyFat > 0 && fatMass > 0) {
            const calculatedWeight = fatMass / (bodyFat / 100);
            const roundedWeight = Math.round(calculatedWeight * 10) / 10;

            if (bodyGoals.targetWeight !== roundedWeight) {
                setBodyGoals((prev: any) => ({ ...prev, targetWeight: roundedWeight }));
            }
        }
    }, [bodyGoals.targetFatMass, bodyGoals.targetBodyFat]);

    // Save Goal Changes to Firestore
    const saveGoalsToFirestore = async (newGoals: any, newBodyGoals: any) => {
        if (!user) return;
        const db = getFirebaseDb();
        try {
            // Firestore does not allow 'undefined' values. Convert to null or remove.
            const sanitizedBodyGoals = JSON.parse(JSON.stringify(newBodyGoals, (key, value) => {
                return value === undefined ? null : value;
            }));

            await setDoc(doc(db, "users", user.uid, "settings", "exercise"), {
                goals: newGoals,
                bodyGoals: sanitizedBodyGoals
            }, { merge: true });
        } catch (e) {
            console.error("Failed to save goals", e);
        }
    };

    // Replace localStorage effects with direct save calls in handlers or debounced effect if needed
    // However, for goals, we usually save on change. But to avoid too many writes, 
    // we should create a specific save function or effect with debounce.
    // user interaction -> state update -> effect -> firestore write.

    // Debounced Save for Goals
    useEffect(() => {
        const timer = setTimeout(() => {
            if (user) saveGoalsToFirestore(goals, bodyGoals);
        }, 1000);
        return () => clearTimeout(timer);
    }, [goals, bodyGoals, user]);


    const handleSaveBodyMetric = async () => {
        if (!bodyMetrics.weight || !user) return;

        const id = Date.now().toString();
        const date = new Date(); // Use current time

        const newMetric = {
            id,
            date: Timestamp.fromDate(date),
            weight: parseFloat(bodyMetrics.weight),
            muscleMass: parseFloat(bodyMetrics.muscleMass) || 0,
            bodyFat: parseFloat(bodyMetrics.bodyFat) || 0,
            fatMass: parseFloat(bodyMetrics.fatMass) || 0
        };

        try {
            const db = getFirebaseDb();
            // Use date-based ID or just random ID
            await setDoc(doc(db, "users", user.uid, "bodyMetrics", id), newMetric);
            alert("신체 정보가 저장되었습니다.");
        } catch (e) {
            console.error("Failed to save body metric", e);
            alert("저장 실패");
        }
    };

    const handleResetBodyMetrics = async () => {
        if (!confirm("모든 신체 기록을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.") || !user) return;

        try {
            const db = getFirebaseDb();
            // Delete all documents in subcollection - Firestore client doesn't support deleting collection directly easily.
            // We have to delete one by one.
            const q = query(collection(db, "users", user.uid, "bodyMetrics"));
            // This reads all docs just to delete, which is fine for small datasets.
            // For now, simpler implementation:
            savedBodyMetrics.forEach(async (m) => {
                await deleteDoc(doc(db, "users", user.uid, "bodyMetrics", m.id));
            });

            setBodyMetrics({
                weight: "",
                muscleMass: "",
                bodyFat: "",
                fatMass: ""
            });
            alert("초기화되었습니다.");
        } catch (e) {
            console.error("Failed to reset metrics", e);
        }
    };

    // Form States
    const [workoutType, setWorkoutType] = useState<ExerciseType>("웨이트");
    const [selectedSubTypes, setSelectedSubTypes] = useState<string[]>([]);
    const [duration, setDuration] = useState("60");
    const [calories, setCalories] = useState("0");
    const [intensity, setIntensity] = useState<"낮음" | "보통" | "높음">("보통");
    const [notes, setNotes] = useState("");

    // Running specific states
    const [distance, setDistance] = useState("5.0");
    const [pace, setPace] = useState("5'30\"");

    const categories: ExerciseType[] = ["웨이트", "유산소", "런닝", "기타"];

    const weightSubTypesList = ["가슴", "등", "어깨", "하체", "이두", "삼두", "전완근"];
    const cardioSubTypesList = ["자전거", "천국의 계단", "런닝머신"];

    // Reset form to default when date changes
    useEffect(() => {
        setWorkoutType("웨이트");
        setSelectedSubTypes([]);
        setDuration("60");
        setCalories("0");
        setIntensity("보통");
        setNotes("");
        setDistance("5.0");
        setPace("5'30\"");
    }, [selectedDate]);

    const handleSubTypeToggle = (sub: string) => {
        setSelectedSubTypes(prev =>
            prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
        );
    };

    const handleSave = async () => {
        if (!workoutType || !user) return;

        const id = Date.now().toString();
        const newRecord = {
            id,
            date: Timestamp.fromDate(selectedDate), // Store as Timestamp
            type: workoutType,
            subTypes: selectedSubTypes,
            duration: parseInt(duration) || 0,
            calories: parseInt(calories) || 0,
            intensity,
            notes,
            distance: workoutType === "런닝" ? parseFloat(distance) : null,
            pace: workoutType === "런닝" ? pace : null
        };

        try {
            const db = getFirebaseDb();
            // Use ID as document name for easier updates/deletes
            await setDoc(doc(db, "users", user.uid, "exercises", id), newRecord);

            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);

            // Reset inputs
            setDuration("60");
            setCalories("300");
            setNotes("");
            setSelectedSubTypes([]);
        } catch (e) {
            console.error("Failed to save exercise", e);
            alert("저장 실패");
        }
    };

    const handleUpdate = async (updated: ExerciseRecord) => {
        if (!user) return;
        try {
            const db = getFirebaseDb();
            // Ensure date is Timestamp if it's a Date object (it might be from partial update)
            const updatePayload = {
                ...updated,
                date: updated.date instanceof Date ? Timestamp.fromDate(updated.date) : updated.date
            };

            await setDoc(doc(db, "users", user.uid, "exercises", updated.id), updatePayload, { merge: true });

            setEditingRecord(null);
        } catch (e) {
            console.error("Failed to update", e);
            alert("수정 실패");
        }
    };

    const handleDelete = async (id: string) => {
        if (!user) return;
        try {
            const db = getFirebaseDb();
            await deleteDoc(doc(db, "users", user.uid, "exercises", id));

            if (editingRecord) {
                const remaining = editingRecord.filter((r: any) => r.id !== id);
                if (remaining.length > 0) {
                    setEditingRecord(remaining);
                } else {
                    setEditingRecord(null);
                }
            }
        } catch (e) {
            console.error("Failed to delete", e);
            alert("삭제 실패");
        }
    };

    const handleCalendarClick = (day: Date) => {
        const dayRecords = records.filter(r => isSameDay(r.date, day));
        if (dayRecords.length > 0) {
            setEditingRecord(dayRecords); // 배열로 저장
        } else {
            setSelectedDate(day);
            setEditingRecord(null);
        }
    };

    // Advanced Stats Calculation
    const advStats = useMemo(() => getExerciseAdvancedStats(records, selectedDate), [records, selectedDate]);

    const totalWeeklyTarget = goals.gym + goals.running;
    const weeklyProgress = Math.min((advStats.thisWeekCount / totalWeeklyTarget) * 100, 100);
    const monthlyProgress = Math.min((advStats.thisMonthCount / goals.monthlyTarget) * 100, 100);

    const weeklyStatsChart = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const d = subDays(new Date(), 6 - i);
            const r = records.find(rec => isSameDay(rec.date, d));
            return {
                date: format(d, 'MM/dd'),
                mins: r ? r.duration : 0,
                active: r ? true : false
            };
        });
    }, [records]);

    return (
        <div className="w-full space-y-8 py-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <header className="flex items-center justify-between px-4 sm:px-0">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all">
                        <ChevronLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="text-[2.6rem] md:text-[3.1rem] font-black tracking-tighter text-white leading-tight bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-transparent">운동 대시보드</h1>
                </div>
                <div className="flex items-center gap-6">

                    <div className="flex items-center gap-3 bg-emerald-500/10 px-4 py-2 rounded-2xl border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20 transition-all shadow-lg shadow-emerald-500/5 group"
                        onClick={() => setShowGoalModal(true)}>
                        <Target className="text-emerald-400 w-6 h-6 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-black text-emerald-400 uppercase tracking-widest leading-none">Goal Settings</span>
                    </div>
                </div>
            </header>

            {/* Tab Navigation */}
            <div className="flex justify-center mb-6">
                <div className="bg-white/5 p-1 rounded-2xl flex gap-1 border border-white/5 relative">
                    {['WORKOUT', 'BODY'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`relative px-8 py-3 rounded-xl text-base font-black tracking-wide transition-all z-10 ${activeTab === tab ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
                        >
                            {tab === 'WORKOUT' ? 'Workouts' : 'Body & Stats'}
                            {activeTab === tab && (
                                <motion.div
                                    layoutId="activeTab"
                                    className={`absolute inset-0 rounded-xl -z-10 shadow-lg ${tab === 'WORKOUT' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-indigo-500 shadow-indigo-500/20'}`}
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'WORKOUT' ? (
                    <motion.div
                        key="WORKOUT"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-8"
                    >
                        {/* Visit Stats Comparison */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4 sm:px-0">
                            <div className={`p-6 space-y-4 group transition-all rounded-[32px] border shadow-2xl ${advStats.weekDiff >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-black text-white/60 uppercase tracking-widest">이번 주 운동</span>
                                    <div className={`p-2 rounded-xl ${advStats.weekDiff >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                                        {advStats.weekDiff >= 0 ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-6xl font-black text-white tracking-tighter">{advStats.thisWeekCount}</span>
                                    <span className="text-xl font-bold text-white/40 ml-1">회</span>
                                </div>
                                <div className="space-y-1.5 pt-1">
                                    <p className={`text-sm font-bold ${advStats.weekDiff >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                                        지난 주 대비 {Math.abs(advStats.weekDiff)}회 {advStats.weekDiff >= 0 ? '증가' : '감소'}
                                    </p>
                                    <div className="flex gap-2 text-[11px] font-black tracking-tight uppercase text-blue-400/90">
                                        <span>헬스 {advStats.thisWeekGymCount}</span>
                                        <span className="opacity-30">/</span>
                                        <span>런닝 {advStats.thisWeekRunningCount}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={`p-6 space-y-4 group transition-all rounded-[32px] border shadow-2xl ${advStats.monthDiff >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-black text-white/60 uppercase tracking-widest">이번 달 운동</span>
                                    <div className={`p-2 rounded-xl ${advStats.monthDiff >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                                        {advStats.monthDiff >= 0 ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-6xl font-black text-white tracking-tighter">{advStats.thisMonthCount}</span>
                                    <span className="text-xl font-bold text-white/40 ml-1">회</span>
                                </div>
                                <div className="space-y-1.5 pt-1">
                                    <p className={`text-sm font-bold ${advStats.monthDiff >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                                        지난 달 대비 {Math.abs(advStats.monthDiff)}회 {advStats.monthDiff >= 0 ? '증가' : '감소'}
                                    </p>
                                    <div className="flex gap-2 text-[11px] font-black tracking-tight uppercase text-blue-400/90">
                                        <span>헬스 {advStats.thisMonthGymCount}</span>
                                        <span className="opacity-30">/</span>
                                        <span>런닝 {advStats.thisMonthRunningCount}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="glass p-6 space-y-5 border-emerald-500/20 shadow-2xl group transition-all">
                                <div className="flex justify-between items-start">
                                    <span className="text-sm font-black text-emerald-400 uppercase tracking-widest">주간 목표</span>
                                    <Trophy className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]" />
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-6xl font-black text-white tracking-tighter">{advStats.thisWeekCount}</span>
                                    <span className="text-2xl font-bold text-white/20 ml-1">/ {totalWeeklyTarget}</span>
                                    <span className="text-sm font-bold text-white/20 ml-auto pt-1">회</span>
                                </div>
                                <div className="space-y-3">
                                    <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${weeklyProgress}%` }}
                                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                                        />
                                    </div>
                                    <p className="text-[12px] font-black text-white/40 tracking-tight">
                                        {advStats.thisWeekCount >= totalWeeklyTarget ? "🏆 목표 달성 완료!" : `달성까지 ${totalWeeklyTarget - advStats.thisWeekCount}회 남음`}
                                    </p>
                                </div>
                            </div>

                            <div className="glass p-6 space-y-5 border-indigo-500/20 shadow-2xl group transition-all">
                                <div className="flex justify-between items-start">
                                    <span className="text-sm font-black text-indigo-400 uppercase tracking-widest">월간 목표</span>
                                    <Rocket className="w-6 h-6 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.4)]" />
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-6xl font-black text-white tracking-tighter">{advStats.thisMonthCount}</span>
                                    <span className="text-2xl font-bold text-white/20 ml-1">/ {goals.monthlyTarget}</span>
                                    <span className="text-sm font-bold text-white/20 ml-auto pt-1">회</span>
                                </div>
                                <div className="space-y-3">
                                    <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${monthlyProgress}%` }}
                                            className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                                        />
                                    </div>
                                    <p className="text-[12px] font-black text-white/40 tracking-tight">
                                        {advStats.thisMonthCount >= goals.monthlyTarget ? "🚀 목표 정복!" : `달성까지 ${goals.monthlyTarget - advStats.thisMonthCount}회 남음`}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-4 sm:px-0">

                            {/* Left: Input Form (7 cols) */}
                            <section className="lg:col-span-7 glass p-7 space-y-6 h-full flex flex-col">
                                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                            <Zap className="w-5 h-5 text-emerald-400 fill-current" />
                                        </div>
                                        <h3 className="text-xl font-black text-white tracking-tight">오늘의 운동 기록</h3>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/5">
                                            <button
                                                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                                                className="p-1.5 hover:bg-white/10 rounded-full text-white/40 transition-colors"
                                            >
                                                <ChevronLeft className="w-3.5 h-3.5" />
                                            </button>
                                            <span className="text-[10px] font-black text-emerald-400 px-3 py-1">
                                                {format(selectedDate, 'yyyy. MM. dd')}
                                            </span>
                                            <button
                                                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                                                className="p-1.5 hover:bg-white/10 rounded-full text-white/40 transition-colors"
                                            >
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6 flex-1">
                                    {/* 1. 운동 종류 선택 */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-white/40 ml-1 uppercase tracking-widest flex items-center gap-2">
                                            <Activity className="w-3 h-3" /> 대분류 선택
                                        </label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {categories.map(cat => (
                                                <button
                                                    key={cat}
                                                    onClick={() => {
                                                        setWorkoutType(cat);
                                                        setSelectedSubTypes([]);
                                                    }}
                                                    className={`py-3 rounded-2xl text-[11px] font-black transition-all border ${workoutType === cat ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"}`}
                                                >
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 2. 세부 분류 선택 */}
                                    <AnimatePresence mode="wait">
                                        {(workoutType === "웨이트" || workoutType === "유산소") && (
                                            <motion.div
                                                key={workoutType}
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="space-y-4"
                                            >
                                                <label className="text-[10px] font-black text-white/40 ml-1 uppercase tracking-widest flex items-center gap-2">
                                                    <Plus className="w-3 h-3" /> {workoutType === "웨이트" ? "운동 부위" : "기구 선택"}
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {(workoutType === "웨이트" ? weightSubTypesList : cardioSubTypesList).map(sub => (
                                                        <button
                                                            key={sub}
                                                            onClick={() => handleSubTypeToggle(sub)}
                                                            className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all border ${selectedSubTypes.includes(sub) ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]" : "bg-white/5 border-white/5 text-white/30 hover:bg-white/10"}`}
                                                        >
                                                            {sub}
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* 3. 수치 입력 (Keyboard Focused) */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="flex-1 space-y-3">
                                            <label className="text-[10px] font-black text-white/40 ml-1 uppercase tracking-widest flex items-center gap-2">
                                                <Timer className="w-3 h-3" /> 시간 (분)
                                            </label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={duration}
                                                onChange={(e) => setDuration(e.target.value.replace(/[^0-9]/g, ''))}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xl font-black text-white focus:outline-none focus:border-emerald-500 transition-all text-center"
                                                placeholder="60"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            {workoutType === "런닝" ? (
                                                <div className="flex-1 space-y-2">
                                                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Distance (km)</label>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={distance}
                                                        onChange={(e) => setDistance(e.target.value.replace(/[^0-9.]/g, ''))}
                                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xl font-black text-white focus:outline-none focus:border-emerald-500 transition-all"
                                                        placeholder="5.0"
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <label className="text-[10px] font-black text-white/40 ml-1 uppercase tracking-widest flex items-center gap-2">
                                                        <Flame className="w-3 h-3" /> 예상 칼로리 (kcal)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={calories}
                                                        onChange={(e) => setCalories(e.target.value.replace(/[^0-9]/g, ''))}
                                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xl font-black text-white focus:outline-none focus:border-orange-500 transition-all text-center"
                                                        placeholder="300"
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {workoutType === "런닝" && (
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-white/40 ml-1 uppercase tracking-widest flex items-center gap-2">
                                                <Navigation className="w-3 h-3" /> 평균 페이스 (ex: 5'30")
                                            </label>
                                            <input
                                                type="text"
                                                value={pace}
                                                onChange={(e) => setPace(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-3xl font-black text-white focus:outline-none focus:border-emerald-500 transition-all text-center"
                                                placeholder="5'30&quot;"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-white/40 ml-1 uppercase tracking-widest flex items-center gap-2">
                                            <FileText className="w-3 h-3" /> 오늘의 운동 메모
                                        </label>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="운동 컨디션이나 수행 내역을 간략히 적어보세요."
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white focus:outline-none focus:border-emerald-500 transition-all min-h-[80px] resize-none"
                                        />
                                    </div>

                                    <button
                                        onClick={handleSave}
                                        className={`w-full py-5 font-black rounded-2xl shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-base tracking-tight ${isSaved ? "bg-emerald-400 text-black shadow-emerald-500/40" : "bg-white text-black hover:bg-white/90"}`}
                                    >
                                        {isSaved ? <><CheckCircle2 className="w-6 h-6" /> 완벽하게 기록되었습니다!</> : <><Plus className="w-6 h-6" /> 운동 데이터 저장하기</>}
                                    </button>
                                </div>
                            </section>

                            {/* Activity Analysis Side Panel */}
                            <div className="lg:col-span-5 h-full">
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="bg-[#0b1121] rounded-[48px] p-12 border border-white/5 shadow-2xl h-full flex flex-col justify-between space-y-12 relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[100px] -z-10" />

                                    {/* Dynamic Header Summary */}
                                    <div className="space-y-1">
                                        <h3 className="text-2xl font-black text-white">활동 주기 분석</h3>
                                        <p className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                                            <span>Total {advStats.thisMonthCount} Wins</span>
                                            <span className="w-1 h-1 bg-white/20 rounded-full" />
                                            <span>
                                                {(() => {
                                                    const today = new Date();
                                                    let daysProp = getDaysInMonth(selectedDate);
                                                    if (isSameMonth(selectedDate, today)) {
                                                        daysProp = getDate(today);
                                                    }
                                                    const freq = advStats.thisMonthCount > 0 ? (daysProp / advStats.thisMonthCount).toFixed(1) : 0;
                                                    return Number(freq) > 0 ? `${freq}일에 1번 꼴` : "기록 없음";
                                                })()}
                                            </span>
                                        </p>
                                    </div>



                                    {/* Mini Calendar & Weekly Breakdown */}
                                    <div className="flex flex-col gap-6 h-full mt-2">
                                        {/* Mini Calendar - Full Width */}
                                        <div className="w-full bg-white/5 rounded-3xl p-6 border border-white/5 shadow-inner">
                                            <div className="grid grid-cols-7 gap-1 text-center mb-3">
                                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                                    <span key={i} className={`text-[10px] font-black ${i === 0 ? 'text-red-400/50' : i === 6 ? 'text-blue-400/50' : 'text-white/20'}`}>{d}</span>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-7 gap-1.5">
                                                {(() => {
                                                    const monthStart = startOfMonth(selectedDate);
                                                    const monthEnd = endOfMonth(selectedDate);
                                                    const start = startOfWeek(monthStart);
                                                    const end = endOfWeek(monthEnd);
                                                    const days = eachDayOfInterval({ start, end });

                                                    return days.map((day, i) => {
                                                        const isCurrentMonth = isSameMonth(day, monthStart);
                                                        const dayRecords = records.filter(r => isSameDay(r.date, day));
                                                        const hasGym = dayRecords.some(r => r.type === '웨이트');
                                                        const hasRun = dayRecords.some(r => r.type === '런닝' || r.type === '유산소');
                                                        const isToday = isSameDay(day, new Date());

                                                        let bgColor = "bg-white/5";
                                                        let textColor = "text-white/20";

                                                        if (hasGym && hasRun) {
                                                            bgColor = "bg-gradient-to-br from-emerald-500/40 to-blue-500/40 border border-emerald-500/20";
                                                            textColor = "text-white font-black";
                                                        } else if (hasGym) {
                                                            bgColor = "bg-emerald-500/30 border border-emerald-500/20";
                                                            textColor = "text-emerald-400 font-black";
                                                        } else if (hasRun) {
                                                            bgColor = "bg-blue-500/30 border border-blue-500/20";
                                                            textColor = "text-blue-400 font-black";
                                                        }

                                                        return (
                                                            <div key={i} className={`
                                                                aspect-square rounded-xl flex items-center justify-center text-[11px] transition-all relative
                                                                ${!isCurrentMonth ? 'opacity-10 grayscale pointer-events-none' : ''}
                                                                ${bgColor} ${textColor}
                                                                ${isToday ? 'ring-2 ring-white/20' : ''}
                                                                hover:scale-110 cursor-default
                                                            `}>
                                                                {format(day, 'd')}
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>

                                        {/* Weekly List - Split into Gym/Run */}
                                        <div className="w-full grid grid-cols-1 gap-2">
                                            {(() => {
                                                const monthStart = startOfMonth(selectedDate);
                                                const monthEnd = endOfMonth(selectedDate);
                                                const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd });

                                                return weeks.map((weekStart, i) => {
                                                    const weekEnd = endOfWeek(weekStart);
                                                    // Filter records within this week AND current month (approx)
                                                    const weeklyRecords = records.filter(r =>
                                                        isWithinInterval(r.date, { start: weekStart, end: weekEnd })
                                                    );

                                                    const gymCount = new Set(weeklyRecords.filter(r => r.type === '웨이트').map(r => format(r.date, 'yyyy-MM-dd'))).size;
                                                    const runCount = new Set(weeklyRecords.filter(r => r.type === '런닝' || r.type === '유산소').map(r => format(r.date, 'yyyy-MM-dd'))).size;

                                                    // Check if this week is part of the selected month
                                                    if (!isSameMonth(weekStart, selectedDate) && !isSameMonth(weekEnd, selectedDate)) return null;

                                                    return (
                                                        <div key={i} className="flex items-center justify-between group bg-white/5 p-3 rounded-2xl border border-white/5 hover:bg-white/10 transition-all">
                                                            <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest group-hover:text-white/60 transition-colors w-20">
                                                                @{i + 1} Week
                                                            </span>
                                                            <div className="flex items-center gap-4 flex-1 justify-end">
                                                                {gymCount > 0 && (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="text-base font-extrabold text-white tracking-tight">{gymCount}</div>
                                                                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Gym</span>
                                                                    </div>
                                                                )}
                                                                {runCount > 0 && (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="text-base font-extrabold text-white tracking-tight">{runCount}</div>
                                                                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Run</span>
                                                                    </div>
                                                                )}
                                                                {gymCount === 0 && runCount === 0 && (
                                                                    <span className="text-[11px] font-bold text-white/20">-</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </div>

                        {/* Large Activity Calendar Integration (Full Width) */}
                        <section className="glass px-3 py-10 space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                            <CalendarIcon className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <h3 className="text-2xl font-black text-white tracking-tight">활동 히스토리 타임라인</h3>
                                    </div>
                                    <p className="text-sm text-white/40 font-bold ml-12">한눈에 보는 이달의 운동 성과. 각 날짜를 선택하여 상세 기록을 확인하세요.</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setShowHistoryModal(true)}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-sm transition-all border border-white/5 active:scale-95"
                                    >
                                        <HistoryIcon className="w-4 h-4 text-emerald-400" />
                                        전체 기록 보기
                                    </button>
                                    <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/5">
                                        <span className="text-sm font-black text-white px-3 py-1">
                                            {format(selectedDate, 'yyyy년 MM월')}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-px bg-white/5 rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
                                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, i) => (
                                    <div key={day} className={`text-center text-[11px] font-black py-6 bg-[#0b1121]/80 ${i === 0 ? 'text-red-400/60' : i === 6 ? 'text-blue-400/60' : 'text-white/20'}`}>
                                        {day}
                                    </div>
                                ))}

                                {(() => {
                                    const monthStart = startOfMonth(selectedDate);
                                    const monthEnd = endOfMonth(selectedDate);
                                    const startDate = startOfWeek(monthStart);
                                    const endDate = endOfWeek(monthEnd);
                                    const days = eachDayOfInterval({ start: startDate, end: endDate });

                                    return days.map((day) => {
                                        const isCurrentMonth = isSameMonth(day, monthStart);
                                        const dayRecords = records.filter(r => isSameDay(r.date, day));
                                        const isSelected = isSameDay(day, selectedDate);
                                        const isToday = isSameDay(day, new Date());

                                        return (
                                            <button
                                                key={day.toISOString()}
                                                onClick={() => handleCalendarClick(day)}
                                                className={`
                                            min-h-[140px] p-4 flex flex-col items-start gap-2 transition-all relative group
                                            ${!isCurrentMonth ? 'bg-black/20 opacity-20 pointer-events-none' : 'bg-[#0b1121] hover:bg-white/[0.03]'}
                                            ${isSelected && dayRecords.length === 0 ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-500/5' : ''}
                                            ${isSelected && dayRecords.length > 0 ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-500/10' : ''}
                                            ${isToday ? 'bg-white/[0.03]' : ''}
                                        `}
                                            >
                                                <div className="flex items-center justify-between w-full mb-2">
                                                    <span className={`
                                                text-sm font-black w-8 h-8 flex items-center justify-center rounded-full
                                                ${isToday ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40' :
                                                            isSelected ? 'bg-white/10 text-white' : 'text-white/40'}
                                            `}>
                                                        {format(day, 'd')}
                                                    </span>
                                                    {dayRecords.length > 0 && (
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                                    )}
                                                </div>

                                                {/* Records Summary Badges */}
                                                <div className="flex flex-col gap-1 w-full mt-1">
                                                    {dayRecords.slice(0, 3).map((r, i) => (
                                                        <div key={i} className={`
                                                    text-[9px] px-2 py-1 rounded-md font-bold truncate w-full text-left
                                                    ${r.type === '웨이트' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' :
                                                                r.type === '런닝' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/10' :
                                                                    'bg-orange-500/10 text-orange-400 border border-orange-500/10'}
                                                `}>
                                                            {r.type} {r.type === '웨이트' && r.subTypes?.[0] ? `(${r.subTypes[0]})` : ''}
                                                        </div>
                                                    ))}
                                                    {dayRecords.length > 3 && (
                                                        <span className="text-[9px] text-white/20 font-bold pl-1">+{dayRecords.length - 3} more</span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    });
                                })()}
                            </div>
                        </section >
                    </motion.div >
                ) : (
                    <motion.div
                        key="BODY"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* Body Composition Tracker */}
                        <section className="glass p-8 space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                                        <Scale className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <h3 className="text-3xl font-black text-white tracking-tight">신체 구성 분석</h3>
                                </div>
                                <div
                                    onClick={() => setShowBodyGoalModal(true)}
                                    className="flex items-center gap-2 bg-indigo-500/10 px-4 py-2 rounded-2xl border border-indigo-500/20 cursor-pointer hover:bg-indigo-500/20 transition-all shadow-lg shadow-indigo-500/5 group"
                                >
                                    <Target className="text-indigo-400 w-4 h-4 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none">목표 설정</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Weight Input Card */}
                                <div className="bg-white/5 rounded-3xl p-6 space-y-4 border border-white/5 relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Scale className="w-24 h-24 rotate-12" />
                                    </div>
                                    <div className="flex justify-between items-start">
                                        <label className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                                            <Scale className="w-3 h-3" /> Body Weight
                                        </label>
                                        {bodyGoals.targetWeight > 0 && (
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Target</span>
                                                <span className="text-xs font-bold text-indigo-400">{bodyGoals.targetWeight} kg</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={bodyMetrics.weight}
                                            onChange={(e) => setBodyMetrics(prev => ({ ...prev, weight: e.target.value.replace(/[^0-9.]/g, '') }))}
                                            className="w-full bg-transparent text-5xl font-black text-white focus:outline-none placeholder:text-white/10"
                                            placeholder="00.0"
                                        />
                                        <span className="text-sm font-bold text-white/40">kg</span>
                                    </div>
                                    {bodyGoals.targetWeight > 0 && bodyMetrics.weight && (
                                        <div className="space-y-2 w-full">
                                            <div className="flex items-center justify-between text-[10px] font-bold">
                                                {parseFloat(bodyMetrics.weight) <= bodyGoals.targetWeight ? (
                                                    <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 목표 달성!</span>
                                                ) : (
                                                    <span className="text-white/40 flex items-center gap-1">
                                                        목표까지 <span className="text-indigo-400">{Math.abs(parseFloat(bodyMetrics.weight) - bodyGoals.targetWeight).toFixed(1)}kg</span> 남음
                                                    </span>
                                                )}
                                                {bodyGoals.deadline && (
                                                    <span className="text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                                                        D-{Math.max(0, differenceInDays(new Date(bodyGoals.deadline), new Date()))}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Progress Bar */}
                                            {bodyGoals.startDate && (
                                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-500 transition-all duration-1000"
                                                        style={{
                                                            width: `${Math.min(100, Math.max(0, ((parseFloat(bodyMetrics.weight) - 0) / (bodyGoals.targetWeight - 0)) * 100))}%` // Simple validation needed for correct calc direction
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Muscle Mass Input Card */}
                                <div className="bg-white/5 rounded-3xl p-6 space-y-4 border border-white/5 relative overflow-hidden group hover:border-rose-500/30 transition-all">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <BicepsFlexed className="w-24 h-24 rotate-12" />
                                    </div>
                                    <div className="flex justify-between items-start">
                                        <label className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                                            <BicepsFlexed className="w-3 h-3" /> Muscle Mass
                                        </label>
                                        {bodyGoals.targetMuscleMass > 0 && (
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Target</span>
                                                <span className="text-xs font-bold text-rose-400">{bodyGoals.targetMuscleMass} kg</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={bodyMetrics.muscleMass}
                                            onChange={(e) => setBodyMetrics(prev => ({ ...prev, muscleMass: e.target.value.replace(/[^0-9.]/g, '') }))}
                                            className="w-full bg-transparent text-5xl font-black text-white focus:outline-none placeholder:text-white/10"
                                            placeholder="00.0"
                                        />
                                        <span className="text-sm font-bold text-white/40">kg</span>
                                    </div>
                                    {bodyGoals.targetMuscleMass > 0 && bodyMetrics.muscleMass && (
                                        <div className="space-y-2 w-full">
                                            <div className="flex items-center justify-between text-[10px] font-bold">
                                                {parseFloat(bodyMetrics.muscleMass) >= bodyGoals.targetMuscleMass ? (
                                                    <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 목표 달성!</span>
                                                ) : (
                                                    <span className="text-white/40 flex items-center gap-1">
                                                        목표까지 <span className="text-rose-400">{Math.abs(bodyGoals.targetMuscleMass - parseFloat(bodyMetrics.muscleMass)).toFixed(1)}kg</span> 증량 필요
                                                    </span>
                                                )}
                                                {bodyGoals.deadline && (
                                                    <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
                                                        D-{Math.max(0, differenceInDays(new Date(bodyGoals.deadline), new Date()))}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Body Fat Percentage Input Card */}
                                <div className="bg-white/5 rounded-3xl p-6 space-y-4 border border-white/5 relative overflow-hidden group hover:border-yellow-500/30 transition-all">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <PersonStanding className="w-24 h-24 rotate-12" />
                                    </div>
                                    <div className="flex justify-between items-start">
                                        <label className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                                            <PersonStanding className="w-3 h-3" /> 체지방률 (Body Fat %)
                                        </label>
                                        {bodyGoals.targetBodyFat > 0 && (
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Target</span>
                                                <span className="text-xs font-bold text-yellow-400">{bodyGoals.targetBodyFat}%</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={bodyMetrics.bodyFat}
                                            onChange={(e) => setBodyMetrics(prev => ({ ...prev, bodyFat: e.target.value.replace(/[^0-9.]/g, '') }))}
                                            className="w-full bg-transparent text-5xl font-black text-white focus:outline-none placeholder:text-white/10"
                                            placeholder="00.0"
                                        />
                                        <span className="text-sm font-bold text-white/40">%</span>
                                    </div>
                                    {bodyGoals.targetBodyFat > 0 && bodyMetrics.bodyFat && (
                                        <div className="space-y-2 w-full">
                                            <div className="flex items-center justify-between text-[10px] font-bold">
                                                {parseFloat(bodyMetrics.bodyFat) <= bodyGoals.targetBodyFat ? (
                                                    <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 목표 달성!</span>
                                                ) : (
                                                    <span className="text-white/40 flex items-center gap-1">
                                                        목표까지 <span className="text-yellow-400">{Math.abs(parseFloat(bodyMetrics.bodyFat) - bodyGoals.targetBodyFat).toFixed(1)}%</span> 감량 필요
                                                    </span>
                                                )}
                                                {bodyGoals.deadline && (
                                                    <span className="text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-md">
                                                        D-{Math.max(0, differenceInDays(new Date(bodyGoals.deadline), new Date()))}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Fat Mass Input Card */}
                                <div className="bg-white/5 rounded-3xl p-6 space-y-4 border border-white/5 relative overflow-hidden group hover:border-orange-500/30 transition-all">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Flame className="w-24 h-24 rotate-12" />
                                    </div>
                                    <div className="flex justify-between items-start">
                                        <label className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                                            <Flame className="w-3 h-3" /> 체지방량 (Fat Mass)
                                        </label>
                                        {(bodyGoals.targetFatMass || 0) > 0 && (
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Target</span>
                                                <span className="text-xs font-bold text-orange-400">{bodyGoals.targetFatMass} kg</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={bodyMetrics.fatMass || ''}
                                            onChange={(e) => setBodyMetrics((prev: any) => ({ ...prev, fatMass: e.target.value.replace(/[^0-9.]/g, '') }))}
                                            className="w-full bg-transparent text-5xl font-black text-white focus:outline-none placeholder:text-white/10"
                                            placeholder="00.0"
                                        />
                                        <span className="text-sm font-bold text-white/40">kg</span>
                                    </div>
                                    {(bodyGoals.targetFatMass || 0) > 0 && bodyMetrics.fatMass && (
                                        <div className="space-y-2 w-full">
                                            <div className="flex items-center justify-between text-[10px] font-bold">
                                                {parseFloat(String(bodyMetrics.fatMass)) <= (bodyGoals.targetFatMass || 0) ? (
                                                    <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 목표 달성!</span>
                                                ) : (
                                                    <span className="text-white/40 flex items-center gap-1">
                                                        목표까지 <span className="text-orange-400">{Math.abs(parseFloat(String(bodyMetrics.fatMass)) - (bodyGoals.targetFatMass || 0)).toFixed(1)}kg</span> 감량 필요
                                                    </span>
                                                )}
                                                {bodyGoals.deadline && (
                                                    <span className="text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md">
                                                        D-{Math.max(0, differenceInDays(new Date(bodyGoals.deadline), new Date()))}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <button
                                    onClick={handleResetBodyMetrics}
                                    className="px-6 py-4 text-red-400 font-bold text-xs uppercase tracking-widest hover:bg-red-500/10 rounded-2xl transition-all"
                                >
                                    데이터 초기화
                                </button>
                                <button
                                    onClick={handleSaveBodyMetric}
                                    className="flex items-center gap-2 px-8 py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                                >
                                    <Save className="w-4 h-4" />
                                    <span className="text-xs uppercase tracking-widest">Update Metrics</span>
                                </button>
                            </div>

                            {/* Trends Chart */}
                            {savedBodyMetrics.length > 0 && (
                                <div className="pt-8 border-t border-white/5 space-y-6">
                                    <h3 className="text-xl font-black text-white">신체 변화 트렌드</h3>
                                    <div className="h-[350px] w-full bg-white/5 rounded-3xl p-6 border border-white/5">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={savedBodyMetrics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                                <XAxis
                                                    dataKey="date"
                                                    tickFormatter={(date: string | number | Date) => format(new Date(date), 'MM/dd')}
                                                    stroke="#ffffff40"
                                                    fontSize={10}
                                                    tickLine={false}
                                                    axisLine={false}
                                                />
                                                <YAxis
                                                    yAxisId="left"
                                                    stroke="#ffffff40"
                                                    fontSize={10}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    domain={['dataMin - 5', 'dataMax + 15']}
                                                />
                                                <YAxis
                                                    yAxisId="right"
                                                    orientation="right"
                                                    stroke="#ffffff40"
                                                    fontSize={10}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    domain={['dataMin - 2', 'dataMax + 8']}
                                                />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#0b1121', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                                    labelStyle={{ color: '#ffffff60', fontSize: '10px', marginBottom: '8px' }}
                                                    labelFormatter={(date: string | number | Date) => format(new Date(date), 'yyyy년 MM월 dd일')}
                                                    itemSorter={(item: any) => {
                                                        const order: Record<string, number> = {
                                                            "체중 (kg)": 1,
                                                            "골격근량 (kg)": 2,
                                                            "체지방률 (%)": 3,
                                                            "체지방량 (kg)": 4
                                                        };
                                                        return order[item.name as string] || 10;
                                                    }}
                                                />
                                                <Line
                                                    yAxisId="left"
                                                    type="monotone"
                                                    dataKey="weight"
                                                    name="체중 (kg)"
                                                    stroke="#818cf8"
                                                    strokeWidth={3}
                                                    dot={{ r: 4, strokeWidth: 0, fill: "#818cf8" }}
                                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                                    label={{ position: 'top', fill: '#818cf8', fontSize: 11, fontWeight: 'bold', dy: -25 }}
                                                />
                                                <Line
                                                    yAxisId="left"
                                                    type="monotone"
                                                    dataKey="muscleMass"
                                                    name="골격근량 (kg)"
                                                    stroke="#fb7185"
                                                    strokeWidth={3}
                                                    dot={{ r: 4, strokeWidth: 0, fill: "#fb7185" }}
                                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                                    label={{ position: 'top', fill: '#fb7185', fontSize: 11, fontWeight: 'bold', dy: -15 }}
                                                />
                                                <Line
                                                    yAxisId="right"
                                                    type="monotone"
                                                    dataKey="bodyFat"
                                                    name="체지방률 (%)"
                                                    stroke="#facc15"
                                                    strokeWidth={3}
                                                    dot={{ r: 4, strokeWidth: 0, fill: "#facc15" }}
                                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                                    label={{ position: 'top', fill: '#facc15', fontSize: 11, fontWeight: 'bold', dy: -15 }}
                                                />
                                                <Line
                                                    yAxisId="left"
                                                    type="monotone"
                                                    dataKey="fatMass"
                                                    name="체지방량 (kg)"
                                                    stroke="#f97316"
                                                    strokeWidth={3}
                                                    dot={{ r: 4, strokeWidth: 0, fill: "#f97316" }}
                                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                                    label={{ position: 'bottom', fill: '#f97316', fontSize: 11, fontWeight: 'bold', dy: 15 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </section>
                    </motion.div>
                )
                }
            </AnimatePresence >

            {/* Goal Setting Modal */}
            <AnimatePresence>
                {
                    showGoalModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowGoalModal(false)}
                                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="bg-[#0b1121] border border-white/10 w-full max-w-md rounded-[40px] p-10 shadow-2xl relative z-10"
                            >
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400">
                                        <Target className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-white tracking-tight">운동 목표 설정</h3>
                                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Exercise Targets</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-white/40 ml-1 uppercase tracking-widest flex items-center gap-2">
                                            <Dumbbell className="w-3 h-3" /> 웨이트/유산소 목표 (회/주)
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={goals.gym}
                                            onChange={(e) => setGoals(prev => ({ ...prev, gym: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-2xl font-black text-white focus:outline-none focus:border-emerald-500 transition-all text-center"
                                        />
                                    </div>
                                    <label className="text-[10px] font-black text-white/40 ml-1 uppercase tracking-widest flex items-center gap-2">
                                        <Activity className="w-3 h-3" /> 런닝 목표 (회/주)
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={goals.running}
                                        onChange={(e) => setGoals(prev => ({ ...prev, running: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-2xl font-black text-white focus:outline-none focus:border-emerald-500 transition-all text-center"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-white/40 ml-1 uppercase tracking-widest flex items-center gap-2">
                                        <Target className="w-3 h-3" /> 월간 총 운동 목표 (회/월)
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={goals.monthlyTarget}
                                        onChange={(e) => setGoals(prev => ({ ...prev, monthlyTarget: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-2xl font-black text-white focus:outline-none focus:border-emerald-500 transition-all text-center"
                                    />
                                </div>
                                <button
                                    onClick={() => setShowGoalModal(false)}
                                    className="w-full py-5 bg-white text-black font-black rounded-2xl shadow-xl hover:bg-white/90 transition-all active:scale-95 mt-4"
                                >
                                    목표 적용하기
                                </button>
                                <button
                                    onClick={() => setShowGoalModal(false)}
                                    className="w-full py-3 text-white/20 font-bold text-xs hover:text-white/40 transition-colors"
                                >
                                    나중에 할게요
                                </button>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence >

            {/* Multi-Record Edit Modal */}
            <AnimatePresence>
                {
                    editingRecord && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setEditingRecord(null)}
                                className="absolute inset-0 bg-black/90 backdrop-blur-md"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                                className="bg-[#0b1121] border border-white/10 w-full max-w-2xl rounded-[50px] overflow-hidden shadow-2xl relative z-10 max-h-[90vh] flex flex-col"
                            >
                                <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400">
                                            <CalendarIcon className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-white tracking-tight">운동 활동 리포트</h3>
                                            <p className="text-xs text-white/40 font-bold uppercase tracking-widest">
                                                {editingRecord.length > 0 && format(editingRecord[0].date, 'yyyy년 MM월 dd일')}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setEditingRecord(null)}
                                        className="p-3 hover:bg-white/5 rounded-full text-white/20 hover:text-white transition-all"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
                                    {editingRecord.map((record: any, idx: number) => (
                                        <div key={record.id} className="glass p-8 space-y-6 relative group overflow-hidden border-white/5 hover:border-emerald-500/30 transition-all">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                                                <Dumbbell className="w-20 h-20 rotate-12" />
                                            </div>

                                            <div className="flex items-center justify-between relative z-10">
                                                <div className="flex items-center gap-3">
                                                    <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${record.type === '런닝' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                                                        }`}>
                                                        {record.type}
                                                    </div>
                                                    <span className="text-white/20 text-[10px] font-black">#{idx + 1} Record</span>
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(record.id)}
                                                    className="p-3 text-red-400 bg-red-400/10 hover:bg-red-400 hover:text-white rounded-xl transition-all flex items-center gap-2 group/del"
                                                    title="기록 삭제"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    <span className="text-[10px] font-black uppercase hidden group-hover/del:block">Delete</span>
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-6 relative z-10">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Time (Mins)</label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={record.duration}
                                                        onChange={(e) => {
                                                            const updated = [...editingRecord];
                                                            updated[idx] = { ...record, duration: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 };
                                                            setEditingRecord(updated);
                                                        }}
                                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xl font-black text-white focus:outline-none focus:border-emerald-500 transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Energy (Kcal)</label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={record.calories || 0}
                                                        onChange={(e) => {
                                                            const updated = [...editingRecord];
                                                            updated[idx] = { ...record, calories: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 };
                                                            setEditingRecord(updated);
                                                        }}
                                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xl font-black text-white focus:outline-none focus:border-emerald-500 transition-all"
                                                    />
                                                </div>
                                            </div>

                                            {/* SubTypes Editing (New Feature: Toggle Buttons) */}
                                            <div className="space-y-2 relative z-10">
                                                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">
                                                    {record.type === '웨이트' ? '타겟 부위 선택' : '세부 종목 선택'}
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {(record.type === '웨이트' ? weightSubTypesList : cardioSubTypesList).map((sub) => {
                                                        const isSelected = (record.subTypes || []).includes(sub);
                                                        return (
                                                            <button
                                                                key={sub}
                                                                onClick={() => {
                                                                    const current = record.subTypes || [];
                                                                    const newSubTypes = isSelected
                                                                        ? current.filter((s: string) => s !== sub)
                                                                        : [...current, sub];

                                                                    const updated = [...editingRecord];
                                                                    updated[idx] = { ...record, subTypes: newSubTypes };
                                                                    setEditingRecord(updated);
                                                                }}
                                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isSelected
                                                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                                                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                                                                    }`}
                                                            >
                                                                {sub}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {record.type === "런닝" && (
                                                <div className="grid grid-cols-2 gap-6 relative z-10">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Distance (km)</label>
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={record.distance || 0}
                                                            onChange={(e) => {
                                                                const updated = [...editingRecord];
                                                                updated[idx] = { ...record, distance: parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0 };
                                                                setEditingRecord(updated);
                                                            }}
                                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xl font-black text-white focus:outline-none focus:border-emerald-500 transition-all"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Pace</label>
                                                        <input
                                                            type="text"
                                                            value={record.pace || ""}
                                                            onChange={(e) => {
                                                                const updated = [...editingRecord];
                                                                updated[idx] = { ...record, pace: e.target.value };
                                                                setEditingRecord(updated);
                                                            }}
                                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xl font-black text-white focus:outline-none focus:border-emerald-500 transition-all"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-2 relative z-10">
                                                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Notes</label>
                                                <textarea
                                                    value={record.notes || ""}
                                                    onChange={(e) => {
                                                        const updated = [...editingRecord];
                                                        updated[idx] = { ...record, notes: e.target.value };
                                                        setEditingRecord(updated);
                                                    }}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-medium text-white/80 focus:outline-none focus:border-emerald-500 transition-all min-h-[80px] resize-none"
                                                />
                                            </div>

                                            <button
                                                onClick={() => handleUpdate(record)}
                                                className="w-full py-4 bg-white/5 hover:bg-emerald-500/20 text-emerald-400 font-black rounded-2xl border border-emerald-500/10 transition-all text-xs uppercase tracking-widest"
                                            >
                                                이 기록만 업데이트하기
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-10 bg-white/[0.02] border-t border-white/5 flex gap-4">
                                    <button
                                        onClick={() => setEditingRecord(null)}
                                        className="flex-1 py-5 bg-white/5 text-white/40 font-black rounded-3xl hover:bg-white/10 transition-all"
                                    >
                                        닫기
                                    </button>
                                    <button
                                        onClick={() => {
                                            editingRecord.forEach((r: any) => handleUpdate(r));
                                            setEditingRecord(null);
                                        }}
                                        className="flex-[2] py-5 bg-emerald-500 text-white font-black rounded-3xl shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 transition-all"
                                    >
                                        모든 변경사항 저장하고 닫기
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence >


            {/* Body Goal Setting Modal */}
            <AnimatePresence>
                {
                    showBodyGoalModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowBodyGoalModal(false)}
                                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="bg-[#0b1121] border border-white/10 w-full max-w-md rounded-[40px] p-10 shadow-2xl relative z-10"
                            >
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
                                        <Target className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-white tracking-tight">신체 목표 설정</h3>
                                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Body Metrics Targets</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-white/40 ml-1 uppercase tracking-widest flex items-center gap-2">
                                            <Scale className="w-3 h-3" /> 목표 체중 (kg) <span className="text-indigo-400 font-normal normal-case">(자동 계산됨)</span>
                                        </label>
                                        <input
                                            type="text"
                                            readOnly
                                            value={bodyGoals.targetWeight || ''}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-2xl font-black text-white/50 focus:outline-none cursor-not-allowed text-center"
                                            placeholder="목표 체지방/체지방률 입력 시 자동 계산"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-white/40 ml-1 uppercase tracking-widest flex items-center gap-2">
                                            <BicepsFlexed className="w-3 h-3" /> 목표 골격근량 (kg)
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={bodyGoals.targetMuscleMass || ''}
                                            onChange={(e) => setBodyGoals((prev: any) => ({ ...prev, targetMuscleMass: e.target.value.replace(/[^0-9.]/g, '') }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-2xl font-black text-white focus:outline-none focus:border-rose-500 transition-all text-center"
                                            placeholder="00.0"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-white/40 ml-1 uppercase tracking-widest flex items-center gap-2">
                                            <PersonStanding className="w-3 h-3" /> 목표 체지방률 (%)
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={bodyGoals.targetBodyFat || ''}
                                            onChange={(e) => setBodyGoals((prev: any) => ({ ...prev, targetBodyFat: e.target.value.replace(/[^0-9.]/g, '') }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-2xl font-black text-white focus:outline-none focus:border-yellow-500 transition-all text-center"
                                            placeholder="00.0"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-white/40 ml-1 uppercase tracking-widest flex items-center gap-2">
                                            <Flame className="w-3 h-3" /> 목표 체지방량 (kg)
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={bodyGoals.targetFatMass || ''}
                                            onChange={(e) => setBodyGoals((prev: any) => ({ ...prev, targetFatMass: e.target.value.replace(/[^0-9.]/g, '') }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-2xl font-black text-white focus:outline-none focus:border-orange-500 transition-all text-center"
                                            placeholder="00.0"
                                        />
                                    </div>
                                    <div className="space-y-3 pt-4 border-t border-white/5">
                                        <label className="text-[10px] font-black text-white/40 ml-1 uppercase tracking-widest flex items-center gap-2">
                                            <CalendarIcon className="w-3 h-3" /> 목표 달성 기한
                                        </label>
                                        <input
                                            type="date"
                                            value={bodyGoals.deadline || ''}
                                            onChange={(e) => setBodyGoals((prev: any) => ({
                                                ...prev,
                                                deadline: e.target.value,
                                                startDate: prev.startDate || new Date().toISOString()
                                            }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white focus:outline-none focus:border-indigo-500 transition-all text-center"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4 mt-8">
                                    <button
                                        onClick={() => setShowBodyGoalModal(false)}
                                        className="flex-1 py-4 bg-white/5 text-white/40 font-bold rounded-2xl hover:bg-white/10 transition-all text-xs"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={() => {
                                            // Parse to float before saving/closing if needed, or just let it autosave via useEffect
                                            // Ensure inputs are numbers for consistency
                                            setBodyGoals((prev: any) => ({
                                                ...prev,
                                                targetWeight: parseFloat(String(prev.targetWeight)) || 0,
                                                targetMuscleMass: parseFloat(String(prev.targetMuscleMass)) || 0,
                                                targetBodyFat: parseFloat(String(prev.targetBodyFat)) || 0,
                                                targetFatMass: parseFloat(String(prev.targetFatMass)) || 0,
                                            }));
                                            setShowBodyGoalModal(false);
                                        }}
                                        className="flex-[2] py-4 bg-indigo-500 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-400 transition-all active:scale-95 text-xs uppercase tracking-widest"
                                    >
                                        목표 저장하기
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence >
            {/* Exercise History Modal */}
            <AnimatePresence>
                {showHistoryModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowHistoryModal(false)}
                            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 40 }}
                            className="relative w-full max-w-4xl bg-[#0b1121] border border-white/10 rounded-[48px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-400">
                                        <HistoryIcon className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black text-white tracking-tight">Workout History</h3>
                                        <p className="text-sm text-white/40 font-bold uppercase tracking-widest">누적 운동 기록 & 요약</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowHistoryModal(false)} className="p-4 hover:bg-white/5 rounded-full transition-colors group">
                                    <X className="w-8 h-8 text-white/20 group-hover:text-white" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-12">
                                {/* Overview Stats */}
                                <div className="grid grid-cols-3 gap-6">
                                    <div className="glass p-7 space-y-2">
                                        <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">총 운동 횟수</span>
                                        <div className="text-4xl font-black text-white">{records.length}<span className="text-sm text-white/20 ml-1">sessions</span></div>
                                    </div>
                                    <div className="glass p-7 space-y-2">
                                        <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">총 운동 시간</span>
                                        <div className="text-4xl font-black text-white">{records.reduce((sum, r) => sum + r.duration, 0)}<span className="text-sm text-white/20 ml-1">mins</span></div>
                                    </div>
                                    <div className="glass p-7 space-y-2">
                                        <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">누적 소모 칼로리</span>
                                        <div className="text-4xl font-black text-white">{records.reduce((sum, r) => sum + (r.calories || 0), 0)}<span className="text-sm text-white/20 ml-1">kcal</span></div>
                                    </div>
                                </div>

                                {/* History Log Grouped by Date */}
                                <div className="space-y-8">
                                    <div className="flex items-center gap-4">
                                        <div className="h-px flex-1 bg-white/5" />
                                        <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.3em]">Detailed Records Log</span>
                                        <div className="h-px flex-1 bg-white/5" />
                                    </div>

                                    <div className="space-y-6">
                                        {Object.entries(
                                            records.reduce((acc: any, r) => {
                                                const dateKey = format(r.date, 'yyyy-MM-dd');
                                                if (!acc[dateKey]) acc[dateKey] = [];
                                                acc[dateKey].push(r);
                                                return acc;
                                            }, {})
                                        )
                                            .sort((a, b) => b[0].localeCompare(a[0]))
                                            .map(([date, dailyRecords]: [string, any]) => (
                                                <div key={date} className="space-y-4">
                                                    <div className="flex items-center gap-3 ml-2">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                        <span className="text-sm font-black text-white/60">{format(new Date(date), 'yyyy년 MM월 dd일')}</span>
                                                        <span className="text-[10px] font-bold text-white/20 uppercase">{format(new Date(date), 'EEEE', { locale: ko })}</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {dailyRecords.map((r: any) => (
                                                            <div key={r.id} className="glass p-6 flex items-center justify-between border-white/5 hover:border-white/10 transition-all">
                                                                <div className="flex items-center gap-6">
                                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${r.type === '런닝' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-400/10 text-emerald-400'}`}>
                                                                        {r.type === '런닝' ? <Zap className="w-6 h-6" /> : <Dumbbell className="w-6 h-6" />}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-base font-black text-white tracking-tight">{r.type} {r.subTypes?.length ? `(${r.subTypes.join(', ')})` : ''}</div>
                                                                        <div className="text-xs font-bold text-white/30 flex items-center gap-3">
                                                                            <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> {r.duration}분</span>
                                                                            <span className="flex items-center gap-1"><Flame className="w-3 h-3" /> {r.calories}kcal</span>
                                                                            {r.intensity && <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {r.intensity}</span>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {r.distance && (
                                                                    <div className="text-right">
                                                                        <div className="text-lg font-black text-blue-400">{r.distance}km</div>
                                                                        <div className="text-[10px] font-bold text-white/20 uppercase">{r.pace || '-'} pace</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-8 bg-white/[0.02] border-t border-white/5">
                                <button
                                    onClick={() => setShowHistoryModal(false)}
                                    className="w-full py-5 bg-white/5 hover:bg-white/10 text-white font-black rounded-3xl transition-all border border-white/10 active:scale-[0.98]"
                                >
                                    기록창 닫기
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}
