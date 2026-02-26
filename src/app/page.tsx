"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
    Plus,
    CheckCircle2,
    Circle,
    MoreVertical,
    ChevronLeft,
    ChevronRight,
    Settings2,
    X,
    Clock,
    RotateCcw,
    Sparkles,
    Calendar as CalendarIcon,
    Moon,
    Utensils,
    BookOpen
} from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, getWeekOfMonth } from "date-fns";
import { ko } from "date-fns/locale";
import Link from "next/link";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { getFirebaseDb } from "@/lib/firebase";
import { collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { GoogleCalendarWidget } from "@/components/GoogleCalendarWidget";

export default function Dashboard() {
    const { user } = useAuth();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [categories, setCategories] = useState<any[]>([]);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [selectedColor, setSelectedColor] = useState("#8B5CF6"); // Default Purple
    const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

    const PRESET_COLORS = [
        { name: "Soft Purple", value: "#8B5CF6" },
        { name: "Muted Blue", value: "#3B82F6" },
        { name: "Sage Green", value: "#10B981" },
        { name: "Rose Pink", value: "#EC4899" },
        { name: "Sunset Orange", value: "#F59E0B" },
        { name: "Slate Grey", value: "#64748B" },
    ];
    const [routines, setRoutines] = useState<any[]>([
        { id: '1', title: '아침 물 한잔 마시기', category: '건강', time: '07:30 AM', completed: false, isRecurring: true, repeatType: 'daily' },
        { id: '2', title: '명상 10분', category: '습관', time: '08:00 AM', completed: true, isRecurring: true, repeatType: 'daily' },
    ]);
    const [activeCategory, setActiveCategory] = useState("전체");
    const [isLoaded, setIsLoaded] = useState(false);
    const [editingRoutine, setEditingRoutine] = useState<any>(null);

    // 모달 상태
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [routineToDelete, setRoutineToDelete] = useState<string | null>(null);
    const [newRoutine, setNewRoutine] = useState({
        title: '',
        category: '습관',
        h: '09',
        m: '00',
        ampm: 'AM',
        isRecurring: false,
        repeatType: 'daily',
        dailyType: 'all', // all, weekday, weekend, custom
        customInterval: '1',
        selectedDays: [1, 2, 3, 4, 5], // 0(일)-6(토)
        repeatInterval: '1',
        monthlyDay: format(new Date(), 'd'),
        date: format(selectedDate, 'yyyy-MM-dd') // 신규: 기본 날짜 설정
    });

    // Refs for Auto-focus
    const modalHRef = useRef<HTMLInputElement>(null);
    const modalMRef = useRef<HTMLInputElement>(null);

    // Firestore Load (Real-time)
    useEffect(() => {
        if (!user) return;
        const db = getFirebaseDb();

        // 1. Categories
        const categoriesRef = doc(db, "users", user.uid, "settings", "categories");
        const unsubCategories = onSnapshot(categoriesRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const list = data.list || [];
                // 마이그레이션: 문자열 배열인 경우 객체 배열로 변환
                if (list.length > 0 && typeof list[0] === 'string') {
                    const migrated = list.map((name: string, idx: number) => ({
                        name,
                        color: PRESET_COLORS[idx % PRESET_COLORS.length].value
                    }));
                    saveCategoriesToFirestore(migrated);
                    setCategories(migrated);
                } else {
                    setCategories(list);
                }
            } else {
                const defaultCats = [
                    { name: "습관", color: "#8B5CF6" },
                    { name: "건강", color: "#10B981" },
                    { name: "학습", color: "#3B82F6" }
                ];
                setCategories(defaultCats);
            }
            setIsLoaded(true);
        });

        // 2. Routines
        const routinesRef = collection(db, "users", user.uid, "routines");
        const unsubRoutines = onSnapshot(routinesRef, (snapshot) => {
            const loadedRoutines = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRoutines(loadedRoutines);
        });

        return () => {
            unsubCategories();
            unsubRoutines();
        };
    }, [user]);

    // Migration logic
    useEffect(() => {
        if (!user || !isLoaded) return;

        const migrationDone = localStorage.getItem('migration_done_dashboard');
        if (migrationDone === 'true') return;

        const localRoutinesStr = localStorage.getItem('routines');
        const localCategoriesStr = localStorage.getItem('categories');

        // Firestore에 데이터가 거의 없거나 초기 상태인 경우에만 마이그레이션 실행
        if ((localRoutinesStr || localCategoriesStr) && routines.length <= 2) {
            const db = getFirebaseDb();

            if (localCategoriesStr) {
                try {
                    const localCategories = JSON.parse(localCategoriesStr);
                    if (localCategories.length > 0) {
                        setDoc(doc(db, "users", user.uid, "settings", "categories"), {
                            list: localCategories,
                            updatedAt: serverTimestamp()
                        }, { merge: true });
                    }
                } catch (e) { console.error("Migration error (categories):", e); }
            }

            if (localRoutinesStr) {
                try {
                    const localRoutines = JSON.parse(localRoutinesStr);
                    localRoutines.forEach(async (routine: any) => {
                        const { id, ...data } = routine;
                        await addDoc(collection(db, "users", user.uid, "routines"), {
                            ...data,
                            updatedAt: serverTimestamp()
                        });
                    });
                } catch (e) { console.error("Migration error (routines):", e); }
            }

            localStorage.setItem('migration_done_dashboard', 'true');
            console.log("Dashboard data migration completed.");
        }
    }, [user, isLoaded, routines.length]);

    // Save Categories helper
    const saveCategoriesToFirestore = async (newList: any[]) => {
        if (!user) return;
        const db = getFirebaseDb();
        await setDoc(doc(db, "users", user.uid, "settings", "categories"), {
            list: newList,
            updatedAt: serverTimestamp()
        }, { merge: true });
    };

    // 주간 날짜 배열 생성
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const handleAddRoutine = async () => {
        if (!newRoutine.title || !user) return;

        const db = getFirebaseDb();
        const routineData = {
            title: newRoutine.title,
            category: newRoutine.category,
            time: `${newRoutine.h}:${newRoutine.m} ${newRoutine.ampm}`,
            isRecurring: newRoutine.isRecurring,
            repeatType: newRoutine.repeatType,
            repeatDetails: {
                dailyType: newRoutine.dailyType,
                customInterval: newRoutine.customInterval,
                selectedDays: newRoutine.selectedDays,
                repeatInterval: newRoutine.repeatInterval,
                monthlyDay: newRoutine.monthlyDay
            },
            updatedAt: serverTimestamp()
        };

        if (editingRoutine) {
            await setDoc(doc(db, "users", user.uid, "routines", editingRoutine.id), routineData, { merge: true });
            setEditingRoutine(null);
        } else {
            await addDoc(collection(db, "users", user.uid, "routines"), {
                ...routineData,
                date: newRoutine.date, // 선택된 날짜 사용
                completed: false, // Initial state
                createdAt: serverTimestamp()
            });
        }

        resetNewRoutine();
        setIsModalOpen(false);
    };

    const resetNewRoutine = () => {
        setNewRoutine({
            title: '',
            category: '습관',
            h: '09',
            m: '00',
            ampm: 'AM',
            isRecurring: false,
            repeatType: 'daily',
            dailyType: 'all',
            customInterval: '1',
            selectedDays: [1, 2, 3, 4, 5],
            repeatInterval: '1',
            monthlyDay: format(new Date(), 'd'),
            date: format(selectedDate, 'yyyy-MM-dd')
        });
    };

    const handleDeleteRoutine = (id: string) => {
        setRoutineToDelete(id);
        setIsDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (routineToDelete && user) {
            const db = getFirebaseDb();
            await deleteDoc(doc(db, "users", user.uid, "routines", routineToDelete));
            setIsDeleteConfirmOpen(false);
            setIsModalOpen(false);
            setEditingRoutine(null);
            setRoutineToDelete(null);
        }
    };

    const openEditModal = (routine: any) => {
        setEditingRoutine(routine);

        // Handle potentially missing or malformed time field
        let timePart = "09:00";
        let ampmPart = "AM";

        if (routine.time && typeof routine.time === 'string' && routine.time.includes(' ')) {
            const parts = routine.time.split(' ');
            timePart = parts[0];
            ampmPart = parts[1];
        }

        const [h, m] = timePart.includes(':') ? timePart.split(':') : ["09", "00"];

        setNewRoutine({
            title: routine.title,
            category: routine.category,
            h: h || "09",
            m: m || "00",
            ampm: ampmPart || "AM",
            isRecurring: routine.isRecurring || false,
            repeatType: routine.repeatType || 'daily',
            dailyType: routine.repeatDetails?.dailyType || 'all',
            customInterval: routine.repeatDetails?.customInterval || '1',
            selectedDays: routine.repeatDetails?.selectedDays || [1, 2, 3, 4, 5],
            repeatInterval: routine.repeatDetails?.repeatInterval || '1',
            monthlyDay: routine.repeatDetails?.monthlyDay || format(new Date(), 'd'),
            date: routine.date || format(selectedDate, 'yyyy-MM-dd')
        });
        setIsModalOpen(true);
    };

    const toggleComplete = async (id: string) => {
        if (!user) return;
        const routine = routines.find(r => r.id === id);
        if (!routine) return;

        const db = getFirebaseDb();
        await setDoc(doc(db, "users", user.uid, "routines", id), {
            completed: !routine.completed,
            updatedAt: serverTimestamp()
        }, { merge: true });
    };

    const toggleImportant = async (id: string) => {
        if (!user) return;
        const routine = routines.find(r => r.id === id);
        if (!routine) return;

        const db = getFirebaseDb();
        await setDoc(doc(db, "users", user.uid, "routines", id), {
            isImportant: !routine.isImportant,
            updatedAt: serverTimestamp()
        }, { merge: true });
    };

    const filteredRoutines = routines.filter(r => {
        const categoryMatch = activeCategory === "전체" || r.category === activeCategory;
        if (!categoryMatch) return false;

        const dateStr = format(selectedDate, 'yyyy-MM-dd');

        // 일회성 루틴 필터링
        if (!r.isRecurring) {
            return r.date === dateStr;
        }

        // 반복 루틴 필터링 (기존 로직 유지 또는 확장 가능)
        return true;
    });

    // Time Input Handler
    const handleHChange = (val: string) => {
        const numeric = val.replace(/[^0-9]/g, '').slice(0, 2);
        const num = parseInt(numeric);

        // 시: 1-12 범위 체크 (2자리 찼을 때만 판단)
        if (numeric.length === 2 && (num < 1 || num > 12)) {
            setNewRoutine(prev => ({ ...prev, h: "01" }));
            return;
        }

        setNewRoutine(prev => ({ ...prev, h: numeric }));
        // 2자리가 채워졌을 때만 안정적으로 이동
        if (numeric.length === 2) {
            setTimeout(() => modalMRef.current?.focus(), 10);
        }
    };

    const handleMChange = (val: string) => {
        const numeric = val.replace(/[^0-9]/g, '').slice(0, 2);
        const num = parseInt(numeric);

        // 분: 0-59 범위 체크
        if (numeric.length === 2 && (num < 0 || num > 59)) {
            setNewRoutine(prev => ({ ...prev, m: "00" }));
            return;
        }

        setNewRoutine(prev => ({ ...prev, m: numeric }));
    };

    const handleTimeBlur = (type: 'h' | 'm', val: string) => {
        if (val === "" || val === "0" || val === "00") {
            if (type === 'h') setNewRoutine(prev => ({ ...prev, h: "01" }));
            else setNewRoutine(prev => ({ ...prev, m: "00" }));
        } else {
            const num = parseInt(val);
            if (type === 'h') {
                if (num < 1 || num > 12) setNewRoutine(prev => ({ ...prev, h: "01" }));
                else setNewRoutine(prev => ({ ...prev, h: val.padStart(2, '0') }));
            } else {
                if (num < 0 || num > 59) setNewRoutine(prev => ({ ...prev, m: "00" }));
                else setNewRoutine(prev => ({ ...prev, m: val.padStart(2, '0') }));
            }
        }
    };

    return (
        <div className="space-y-3 animate-in fade-in duration-700">
            {/* Main Title & Quote Header */}
            <div className="pt-4 pb-10">
                <h1 className="text-[2.5819rem] font-black tracking-[-0.02em] text-white leading-[1.2] bg-gradient-to-br from-white via-white to-white/20 bg-clip-text text-transparent">
                    하루하루는 성실히,<br />
                    인생전체는 되는대로
                </h1>
            </div>

            {/* Dashboard 2-Column Layout */}
            <div className="flex flex-col xl:flex-row gap-8 items-start">

                {/* [LEFT] Routine List Section */}
                <div className="flex-1 space-y-8 w-full">
                    {/* Weekly Navigation Header (Moved here to pull sidebar up) */}
                    <header className="flex flex-col items-center gap-3 mb-4">
                        <div className="flex items-center gap-4 text-white/40">
                            <button
                                onClick={() => setSelectedDate(prev => addDays(prev, -7))}
                                className="p-2 hover:bg-white/5 rounded-full transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <h2 className="text-[2.156rem] font-black text-white tracking-tighter">
                                {format(selectedDate, 'M월', { locale: ko })} {getWeekOfMonth(selectedDate, { weekStartsOn: 0 })}주차
                            </h2>
                            <button
                                onClick={() => setSelectedDate(prev => addDays(prev, 7))}
                                className="p-2 hover:bg-white/5 rounded-full transition-colors"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex gap-2 p-2 bg-white/5 rounded-2xl border border-white/5">
                            {weekDays.map((day) => {
                                const isSelected = isSameDay(day, selectedDate);
                                const isToday = isSameDay(day, new Date());

                                return (
                                    <button
                                        key={day.toISOString()}
                                        onClick={() => setSelectedDate(day)}
                                        className={`
                                            relative flex flex-col items-center justify-center w-14 h-20 rounded-xl transition-all duration-300
                                            ${isSelected ? "bg-accent text-white shadow-lg shadow-accent/40" : "text-white/40 hover:bg-white/5"}
                                        `}
                                    >
                                        <span className="text-sm mb-1 font-black uppercase tracking-widest">{format(day, 'EEE', { locale: ko })}</span>
                                        <span className="text-2xl font-black">{format(day, 'd')}</span>
                                        {isToday && (
                                            <span className={`absolute -bottom-1 text-[8px] font-black tracking-tighter ${isSelected ? 'text-white' : 'text-accent'}`}>TODAY</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </header>

                    {/* Category Filter & Add Button */}
                    <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2 no-scrollbar">
                        <Reorder.Group
                            axis="x"
                            values={categories}
                            onReorder={(newOrder) => {
                                setCategories(newOrder);
                                saveCategoriesToFirestore(newOrder);
                            }}
                            className="flex gap-2"
                        >
                            <button
                                onClick={() => setActiveCategory("전체")}
                                className={`
                                    px-4 py-2 rounded-full text-base font-medium transition-all shrink-0
                                    ${activeCategory === "전체"
                                        ? "bg-white text-black"
                                        : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"}
                                `}
                            >
                                전체
                            </button>
                            {categories.map(cat => (
                                <Reorder.Item
                                    key={cat.name}
                                    value={cat}
                                    className="relative flex-shrink-0 group"
                                >
                                    <button
                                        onClick={() => setActiveCategory(cat.name)}
                                        style={{
                                            backgroundColor: activeCategory === cat.name ? cat.color : undefined,
                                            borderColor: activeCategory === cat.name ? cat.color : `${cat.color}20`,
                                            boxShadow: activeCategory === cat.name ? `0 10px 15px -3px ${cat.color}40` : undefined
                                        }}
                                        className={`
                                            px-5 py-2.5 rounded-full text-base font-bold transition-all border shrink-0
                                            ${activeCategory === cat.name
                                                ? "text-black"
                                                : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"}
                                        `}
                                    >
                                        {cat.name}
                                    </button>
                                    {categories.length > 1 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCategoryToDelete(cat.name);
                                            }}
                                            className="absolute -top-1 -right-1 w-4 h-4 bg-white/10 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 hover:scale-110 z-10 border border-white/10 hover:border-red-500"
                                        >
                                            <X className="w-2.5 h-2.5 text-white" />
                                        </button>
                                    )}
                                </Reorder.Item>
                            ))}
                        </Reorder.Group>

                        <button
                            onClick={() => setIsAddingCategory(true)}
                            className="px-6 py-2.5 rounded-full text-sm font-black bg-white/5 text-white/30 hover:bg-white/10 hover:text-white border border-white/5 transition-all flex items-center gap-2 shrink-0 group"
                        >
                            <div className="w-5 h-5 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                <Plus className="w-3 h-3" />
                            </div>
                            <span>카테고리 추가</span>
                        </button>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-8 py-4 bg-accent rounded-full text-lg font-black shadow-xl shadow-accent/30 hover:scale-105 transition-all active:scale-95 whitespace-nowrap"
                    >
                        <Plus className="w-5 h-5" />
                        할 일 추가
                    </button>

                    {/* Routine List Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredRoutines.length === 0 ? (
                            <div className="md:col-span-2 h-64 flex flex-col items-center justify-center text-white/20 border-2 border-dashed border-white/5 rounded-3xl">
                                <p className="text-lg">해당 카테고리의 루틴이 없어요</p>
                                <p className="text-sm mt-1">새로운 루틴을 등록하고 하루를 시작해보세요!</p>
                            </div>
                        ) : (
                            filteredRoutines.map((routine, idx) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    key={routine.id}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        toggleImportant(routine.id);
                                    }}
                                    className={`group glass p-5 flex items-center justify-between hover:border-accent/30 transition-all cursor-pointer 
                                        ${routine.completed ? "opacity-40" : ""} 
                                        ${routine.isImportant ? "border-red-500/50 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.1)] !opacity-100" : ""}
                                    `}
                                >
                                    <div className="flex items-center gap-4 overflow-hidden flex-1" onClick={() => openEditModal(routine)}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleComplete(routine.id);
                                            }}
                                            className={`shrink-0 transition-colors ${routine.completed ? "text-accent" : "text-white/20 hover:text-accent"}`}
                                        >
                                            {routine.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                                        </button>
                                        <div className="truncate">
                                            <h3 className={`font-bold text-lg truncate ${routine.completed ? "line-through text-white/40" : ""}`}>{routine.title}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span
                                                    className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                                                    style={{
                                                        backgroundColor: `${categories.find(c => c.name === routine.category)?.color || '#ffffff'}20`,
                                                        color: categories.find(c => c.name === routine.category)?.color || '#ffffff'
                                                    }}
                                                >
                                                    {routine.category}
                                                </span>
                                                {routine.time && (
                                                    <span className="flex items-center gap-1 text-[10px] text-white/40 font-bold">
                                                        <Clock className="w-2.5 h-2.5" /> {routine.time}
                                                    </span>
                                                )}
                                                {routine.isRecurring && (
                                                    <RotateCcw className="w-2.5 h-2.5 text-accent/60" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => openEditModal(routine)}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-white/20 hover:text-white transition-all"
                                    >
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                {/* [RIGHT] Summary Side Panel */}
                <aside className="w-full xl:w-[350px] space-y-4">
                    <div className="glass p-6 space-y-4 border-accent/20">
                        <h4 className="text-base font-bold text-white/80 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-accent" />
                            오늘의 진행도
                        </h4>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-white/40">달성률</span>
                                <span className="text-accent font-bold">
                                    {Math.round((routines.filter(r => r.completed).length / routines.length) * 100 || 0)}%
                                </span>
                            </div>
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(routines.filter(r => r.completed).length / routines.length) * 100 || 0}%` }}
                                    className="h-full bg-accent"
                                />
                            </div>
                        </div>
                        <p className="text-[11px] text-white/30 leading-relaxed">
                            오늘 총 {routines.length}개의 할 일이 있습니다. {routines.filter(r => !r.completed).length}개가 더 남았어요!
                        </p>
                    </div>

                    <GoogleCalendarWidget selectedDate={selectedDate} />

                    <div className="glass p-6 space-y-4">
                        <h4 className="text-base font-bold text-white/80">EveryDay Tip</h4>
                        <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-sm text-white/80 leading-relaxed">
                            "작은 습관이 모여 위대한 변화를 만듭니다. 오늘 수면 패턴은 어떠셨나요?"
                        </div>
                    </div>
                </aside>
            </div>

            {/* Routine Add/Edit Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                setIsModalOpen(false);
                                setEditingRoutine(null);
                                resetNewRoutine();
                            }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-lg glass p-8 space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar"
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold">{editingRoutine ? "할 일 수정" : "새로운 할 일"}</h2>
                                <button
                                    onClick={() => {
                                        setIsModalOpen(false);
                                        setEditingRoutine(null);
                                        resetNewRoutine();
                                    }}
                                    className="text-white/40 hover:text-white"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Title Input */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/40">루틴 이름</label>
                                    <input
                                        type="text"
                                        placeholder="어떤 일을 하실 건가요?"
                                        value={newRoutine.title}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => setNewRoutine(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-accent transition-all text-lg font-medium"
                                    />
                                </div>

                                {/* Date Input (New) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white/40 flex items-center gap-2">
                                            <CalendarIcon className="w-4 h-4" /> 날짜 선택
                                        </label>
                                        <input
                                            type="date"
                                            value={newRoutine.date}
                                            onChange={(e) => setNewRoutine(prev => ({ ...prev, date: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-accent transition-all text-white font-medium color-scheme-dark"
                                        />
                                    </div>

                                    {/* Custom Time Input (UX Enhanced) */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white/40 flex items-center gap-2">
                                            <Clock className="w-4 h-4" /> 수행 시간
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <div
                                                onClick={() => modalHRef.current?.focus()}
                                                className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-2xl p-2.5 focus-within:border-accent transition-all cursor-text"
                                            >
                                                <input
                                                    ref={modalHRef}
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={newRoutine.h}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onFocus={(e) => e.target.select()}
                                                    onBlur={(e) => handleTimeBlur('h', e.target.value)}
                                                    onChange={(e) => handleHChange(e.target.value)}
                                                    className="w-14 bg-transparent text-2xl font-bold text-center focus:outline-none text-white font-mono"
                                                    placeholder="09"
                                                />
                                                <span className="text-white/20 font-bold text-xl px-1" onClick={(e) => e.stopPropagation()}>:</span>
                                                <input
                                                    ref={modalMRef}
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={newRoutine.m}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onFocus={(e) => e.target.select()}
                                                    onBlur={(e) => handleTimeBlur('m', e.target.value)}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                                                        setNewRoutine(prev => ({ ...prev, m: val }));
                                                    }}
                                                    className="w-14 bg-transparent text-2xl font-bold text-center focus:outline-none text-white font-mono"
                                                    placeholder="00"
                                                />
                                            </div>
                                            <button
                                                onClick={() => setNewRoutine(prev => ({ ...prev, ampm: prev.ampm === "AM" ? "PM" : "AM" }))}
                                                className="w-20 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center font-bold text-accent hover:bg-white/10 transition-all active:scale-95 text-xl"
                                            >
                                                {newRoutine.ampm}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-white/40 ml-1">카테고리</label>
                                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-1">
                                        {categories.map(cat => (
                                            <button
                                                key={cat.name}
                                                type="button"
                                                onClick={() => setNewRoutine(prev => ({ ...prev, category: cat.name }))}
                                                style={{
                                                    backgroundColor: newRoutine.category === cat.name ? cat.color : undefined,
                                                    borderColor: newRoutine.category === cat.name ? cat.color : `${cat.color}20`,
                                                    boxShadow: newRoutine.category === cat.name ? `0 10px 15px -3px ${cat.color}40` : undefined,
                                                    color: newRoutine.category === cat.name ? '#000000' : `${cat.color}60`
                                                }}
                                                className={`
                                                    px-5 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all border
                                                    ${newRoutine.category === cat.name ? "" : "bg-white/5"}
                                                `}
                                            >
                                                {cat.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-white/40 ml-1">구분</label>
                                    <div className="flex p-1.5 bg-white/5 rounded-2xl border border-white/10">
                                        <button
                                            onClick={() => setNewRoutine(prev => ({ ...prev, isRecurring: false }))}
                                            className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${!newRoutine.isRecurring ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"}`}
                                        >
                                            일회성
                                        </button>
                                        <button
                                            onClick={() => setNewRoutine(prev => ({ ...prev, isRecurring: true }))}
                                            className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${newRoutine.isRecurring ? "bg-accent text-white shadow-lg" : "text-white/40 hover:text-white"}`}
                                        >
                                            반복 설정
                                        </button>
                                    </div>
                                </div>

                                {/* Recurring Options */}
                                <AnimatePresence>
                                    {newRoutine.isRecurring && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-4 overflow-hidden pt-2"
                                        >
                                            <div className="p-5 bg-accent/5 rounded-2xl border border-accent/20 space-y-6">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-bold text-accent flex items-center gap-2">
                                                        <RotateCcw className="w-4 h-4" /> 반복 설정
                                                    </span>
                                                </div>

                                                {/* Main Repeat Type Selection */}
                                                <div className="grid grid-cols-3 gap-2">
                                                    {['daily', 'weekly', 'monthly'].map((type) => (
                                                        <button
                                                            key={type}
                                                            onClick={() => setNewRoutine(prev => ({ ...prev, repeatType: type }))}
                                                            className={`py-2.5 rounded-xl text-xs font-black transition-all border ${newRoutine.repeatType === type ? "bg-accent text-white border-accent shadow-md shadow-accent/20" : "bg-white/5 border-white/5 text-white/40"}`}
                                                        >
                                                            {type === 'daily' ? '매일' : type === 'weekly' ? '매주' : '매월'}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* [DAILY OPTIONS] */}
                                                {newRoutine.repeatType === 'daily' && (
                                                    <div className="space-y-3 pt-2">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {['all', 'weekday', 'weekend', 'custom'].map((dType) => (
                                                                <button
                                                                    key={dType}
                                                                    onClick={() => setNewRoutine(prev => ({ ...prev, dailyType: dType }))}
                                                                    className={`py-2 rounded-xl text-[11px] font-bold transition-all border ${newRoutine.dailyType === dType ? "bg-white/10 border-white/20 text-white" : "border-white/5 text-white/30"}`}
                                                                >
                                                                    {dType === 'all' ? '매일 반복' : dType === 'weekday' ? '평일만' : dType === 'weekend' ? '주말만' : '일수 간격'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        {newRoutine.dailyType === 'custom' && (
                                                            <div className="flex items-center gap-3 px-1">
                                                                <span className="text-xs text-white/40">간격 :</span>
                                                                <input
                                                                    type="number"
                                                                    value={newRoutine.customInterval}
                                                                    onChange={(e) => setNewRoutine(prev => ({ ...prev, customInterval: e.target.value }))}
                                                                    className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-center font-bold text-sm focus:outline-none focus:border-accent"
                                                                />
                                                                <span className="text-xs text-white/40">일마다</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* [WEEKLY OPTIONS] */}
                                                {newRoutine.repeatType === 'weekly' && (
                                                    <div className="space-y-4 pt-2">
                                                        <div className="flex items-center gap-3 px-1">
                                                            <span className="text-xs text-white/40 shrink-0">간격 :</span>
                                                            <div className="flex-1 flex items-center bg-white/5 rounded-xl overflow-hidden border border-white/10 p-0.5">
                                                                {[1, 2, 3, 4].map(num => (
                                                                    <button
                                                                        key={num}
                                                                        onClick={() => setNewRoutine(prev => ({ ...prev, repeatInterval: num.toString() }))}
                                                                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${newRoutine.repeatInterval === num.toString() ? "bg-white/10 text-white shadow-sm" : "text-white/20 hover:text-white/40"}`}
                                                                    >
                                                                        {num}주
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-7 gap-1">
                                                            {['월', '화', '수', '목', '금', '토', '일'].map((day, idx) => {
                                                                const dayVal = idx === 6 ? 0 : idx + 1;
                                                                const isSelected = newRoutine.selectedDays.includes(dayVal);
                                                                return (
                                                                    <button
                                                                        key={day}
                                                                        onClick={() => {
                                                                            setNewRoutine(prev => {
                                                                                const exists = prev.selectedDays.includes(dayVal);
                                                                                if (exists) {
                                                                                    return { ...prev, selectedDays: prev.selectedDays.filter(d => d !== dayVal) };
                                                                                }
                                                                                return { ...prev, selectedDays: [...prev.selectedDays, dayVal].sort() };
                                                                            });
                                                                        }}
                                                                        className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold transition-all border ${isSelected ? "bg-accent/20 border-accent/40 text-accent" : "bg-white/5 border-white/5 text-white/20"}`}
                                                                    >
                                                                        {day}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* [MONTHLY OPTIONS] */}
                                                {newRoutine.repeatType === 'monthly' && (
                                                    <div className="space-y-4 pt-2">
                                                        <div className="flex items-center gap-3 px-1">
                                                            <span className="text-sm text-white/40 font-bold shrink-0">매월 :</span>
                                                            <div className="flex-1 flex items-center bg-white/5 rounded-2xl border border-white/10 p-1.5 focus-within:border-accent group">
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max="31"
                                                                    value={newRoutine.monthlyDay}
                                                                    onChange={(e) => setNewRoutine(prev => ({ ...prev, monthlyDay: e.target.value }))}
                                                                    className="flex-1 bg-transparent text-center font-black text-xl text-white outline-none w-16"
                                                                />
                                                                <span className="text-sm text-white/40 font-bold pr-2 group-focus-within:text-accent">일에 반복</span>
                                                            </div>
                                                        </div>
                                                        <div className="bg-purple-500/10 rounded-xl p-3 border border-purple-500/20">
                                                            <p className="text-[10px] text-purple-300 font-bold leading-relaxed flex items-center gap-1.5">
                                                                <Sparkles className="w-3 h-3" />
                                                                31일이 없는 달의 경우 해당 달의 마지막 날에 기록됩니다.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-6 border-t border-white/5">
                                {editingRoutine && (
                                    <button
                                        onClick={() => handleDeleteRoutine(editingRoutine.id)}
                                        className="px-6 py-4 bg-red-500/10 text-red-500 font-bold rounded-2xl hover:bg-red-500/20 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        <X className="w-4 h-4" />
                                        <span>삭제</span>
                                    </button>
                                )}
                                <button
                                    onClick={handleAddRoutine}
                                    className={`py-5 font-black rounded-2xl shadow-xl transition-all active:scale-95 text-lg uppercase tracking-widest flex-1 bg-accent text-white hover:bg-accent/80`}
                                >
                                    {editingRoutine ? "수정 완료" : "루틴 추가하기"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Routine Delete Confirmation Modal */}
            <AnimatePresence>
                {isDeleteConfirmOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsDeleteConfirmOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-sm glass p-8 space-y-6 text-center border-red-500/20"
                        >
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                                <X className="w-8 h-8 text-red-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold">할 일 삭제</h3>
                                <p className="text-white/40 text-sm leading-relaxed">
                                    이 할 일을 정말 삭제하시겠습니까?<br />
                                    삭제된 데이터는 복구할 수 없습니다.
                                </p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setIsDeleteConfirmOpen(false)}
                                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 py-4 bg-red-500 text-white font-bold rounded-2xl shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all active:scale-95"
                                >
                                    삭제하기
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Category Add Modal */}
            <AnimatePresence>
                {isAddingCategory && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                setIsAddingCategory(false);
                                setNewCategoryName("");
                            }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-md glass p-8 space-y-8"
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold">카테고리 추가</h2>
                                <button
                                    onClick={() => {
                                        setIsAddingCategory(false);
                                        setNewCategoryName("");
                                    }}
                                    className="text-white/40 hover:text-white"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/40">카테고리 이름</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="이름을 입력하세요"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                if (newCategoryName && !categories.some(c => c.name === newCategoryName)) {
                                                    const newList = [...categories, { name: newCategoryName, color: selectedColor }];
                                                    saveCategoriesToFirestore(newList);
                                                    setNewCategoryName("");
                                                    setIsAddingCategory(false);
                                                }
                                            }
                                        }}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-accent transition-all text-xl font-bold"
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="text-sm font-medium text-white/40">테마 색상</label>
                                    <div className="grid grid-cols-6 gap-3">
                                        {PRESET_COLORS.map(color => (
                                            <button
                                                key={color.value}
                                                onClick={() => setSelectedColor(color.value)}
                                                className={`
                                                    aspect-square rounded-full transition-all ring-offset-4 ring-offset-black relative
                                                    ${selectedColor === color.value ? 'ring-2 ring-white scale-110 shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'opacity-40 hover:opacity-100 hover:scale-105'}
                                                `}
                                                style={{ backgroundColor: color.value }}
                                            >
                                                {selectedColor === color.value && (
                                                    <motion.div
                                                        layoutId="color-check"
                                                        className="absolute inset-0 flex items-center justify-center"
                                                    >
                                                        <div className="w-2 h-2 bg-white rounded-full" />
                                                    </motion.div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    if (newCategoryName && !categories.some(c => c.name === newCategoryName)) {
                                        const newList = [...categories, { name: newCategoryName, color: selectedColor }];
                                        saveCategoriesToFirestore(newList);
                                        setNewCategoryName("");
                                        setIsAddingCategory(false);
                                    }
                                }}
                                disabled={!newCategoryName || categories.some(c => c.name === newCategoryName)}
                                className={`
                                    w-full py-5 rounded-2xl font-black transition-all active:scale-[0.98]
                                    ${newCategoryName && !categories.some(c => c.name === newCategoryName)
                                        ? "bg-accent text-white shadow-lg shadow-accent/30"
                                        : "bg-white/5 text-white/20 cursor-not-allowed"}
                                `}
                            >
                                카테고리 추가하기
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Category Delete Confirmation Modal */}
            <AnimatePresence>
                {categoryToDelete && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="w-full max-w-sm glass border-red-500/20 shadow-2xl shadow-red-500/10 p-8 space-y-6 text-center"
                        >
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <X className="w-8 h-8 text-red-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-white">카테고리 삭제</h3>
                                <p className="text-sm text-white/40 leading-relaxed font-bold">
                                    <span className="text-white">&apos;{categoryToDelete}&apos;</span> 카테고리를 삭제하시겠습니까?<br />
                                    해당 카테고리의 모든 루틴은 삭제되지 않고<br />
                                    유지됩니다.
                                </p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setCategoryToDelete(null)}
                                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl transition-all active:scale-[0.98]"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={() => {
                                        const newList = categories.filter(c => c.name !== categoryToDelete);
                                        saveCategoriesToFirestore(newList);
                                        if (activeCategory === categoryToDelete) setActiveCategory("전체");
                                        setCategoryToDelete(null);
                                    }}
                                    className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl shadow-lg shadow-red-600/20 transition-all active:scale-[0.98]"
                                >
                                    삭제하기
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
