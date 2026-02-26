"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, BookOpen, Plus, Trash2, Book as BookIcon, Calendar as CalendarIcon, ArrowLeft, BarChart2, Image as ImageIcon, X } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, addDays, getDay, isSameMonth, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { Book, ReadingSession, initialBooks, initialSessions, getMonthlyReadingStats } from "@/lib/readingData";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";
import { collection, onSnapshot, doc, setDoc, deleteDoc, Timestamp, addDoc } from "firebase/firestore";

export default function ReadingPage() {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [books, setBooks] = useState<Book[]>([]);
    const [sessions, setSessions] = useState<ReadingSession[]>([]);
    const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [bookToDelete, setBookToDelete] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [newLog, setNewLog] = useState({
        date: format(new Date(), 'yyyy-MM-dd'),
        startPage: 0,
        endPage: 0
    });
    const [showLogModal, setShowLogModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    const { user } = useAuth();

    // Firestore Load (Real-time)
    useEffect(() => {
        if (!user) return;
        const db = getFirebaseDb();

        // Load Books
        const booksUnsub = onSnapshot(collection(db, "users", user.uid, "books"), (snapshot) => {
            const loadedBooks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                startDate: (doc.data().startDate as Timestamp)?.toDate(),
                completedDate: (doc.data().completedDate as Timestamp)?.toDate(),
            })) as Book[];
            setBooks(loadedBooks);
            setIsLoaded(true);
        });

        // Load Sessions
        const sessionsUnsub = onSnapshot(collection(db, "users", user.uid, "readingSessions"), (snapshot) => {
            const loadedSessions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: (doc.data().date as Timestamp)?.toDate(),
            })) as ReadingSession[];
            setSessions(loadedSessions);
        });

        return () => {
            booksUnsub();
            sessionsUnsub();
        };
    }, [user]);

    // Migration logic
    useEffect(() => {
        if (!user || !isLoaded) return;

        const migrationDone = localStorage.getItem('migration_done_reading');
        if (migrationDone === 'true') return;

        const localBooksStr = localStorage.getItem('reading_books_v1');
        const localSessionsStr = localStorage.getItem('reading_sessions_v1');

        if ((localBooksStr || localSessionsStr) && books.length === initialBooks.length) {
            const db = getFirebaseDb();

            if (localBooksStr) {
                try {
                    const localBooks = JSON.parse(localBooksStr);
                    localBooks.forEach(async (book: any) => {
                        const { id, ...data } = book;
                        // Transform dates if necessary
                        const docData = {
                            ...data,
                            startDate: data.startDate ? Timestamp.fromDate(new Date(data.startDate)) : null,
                            completedDate: data.completedDate ? Timestamp.fromDate(new Date(data.completedDate)) : null,
                        };
                        await addDoc(collection(db, "users", user.uid, "books"), docData);
                    });
                } catch (e) { console.error("Migration error (books):", e); }
            }

            if (localSessionsStr) {
                try {
                    const localSessions = JSON.parse(localSessionsStr);
                    localSessions.forEach(async (session: any) => {
                        const { id, ...data } = session;
                        const docData = {
                            ...data,
                            date: data.date ? Timestamp.fromDate(new Date(data.date)) : null,
                        };
                        await addDoc(collection(db, "users", user.uid, "readingSessions"), docData);
                    });
                } catch (e) { console.error("Migration error (sessions):", e); }
            }

            localStorage.setItem('migration_done_reading', 'true');
            console.log("Reading data migration completed.");
        }
    }, [user, isLoaded, books.length, sessions.length]);

    // Derived State
    const selectedBook = useMemo(() => books.find(b => b.id === selectedBookId), [books, selectedBookId]);
    const monthlyGoal = 2;
    const stats = useMemo(() => getMonthlyReadingStats(books, sessions, selectedDate), [books, sessions, selectedDate]);
    const progressPercentage = Math.min(100, Math.round((stats.completedCount / monthlyGoal) * 100));

    // Calendar Data
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [selectedDate]);

    // Add Book Form State
    const [newBook, setNewBook] = useState<Partial<Book>>({
        title: "",
        author: "",
        totalPage: 0,
        coverColor: "#3b82f6",
        coverImage: "",
        status: "READING",
        startDate: new Date()
    });

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewBook({ ...newBook, coverImage: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddBook = () => {
        if (!newBook.title || !newBook.totalPage || !user) return;
        const book: Omit<Book, 'id'> = {
            title: newBook.title,
            author: newBook.author || "Unknown",
            totalPage: Number(newBook.totalPage),
            currentPage: 0,
            status: "READING",
            coverColor: newBook.coverColor || "#3b82f6",
            coverImage: newBook.coverImage,
            startDate: new Date(),
        };

        const db = getFirebaseDb();
        addDoc(collection(db, "users", user.uid, "books"), book);
        setNewBook({ title: "", author: "", totalPage: 0, coverColor: "#3b82f6", coverImage: "", status: "READING", startDate: new Date() });
    };

    // Log Reading Function
    const handleLogReading = async () => {
        if (!selectedBook || !newLog.endPage || newLog.endPage <= newLog.startPage - 1 || !user) return;

        const amount = newLog.endPage - newLog.startPage + 1;
        const newSession = {
            bookId: selectedBook.id,
            date: Timestamp.fromDate(new Date(newLog.date)),
            startPage: Number(newLog.startPage),
            endPage: Number(newLog.endPage),
            amount: amount
        };

        const db = getFirebaseDb();
        await addDoc(collection(db, "users", user.uid, "readingSessions"), newSession);

        // Update Book Progress
        const isNowCompleted = Number(newLog.endPage) >= selectedBook.totalPage;
        const updatedBookData = {
            currentPage: Math.max(selectedBook.currentPage, Number(newLog.endPage)),
            status: isNowCompleted ? 'COMPLETED' : selectedBook.status,
            completedDate: isNowCompleted ? Timestamp.fromDate(new Date()) : (selectedBook.completedDate ? Timestamp.fromDate(selectedBook.completedDate) : null)
        };

        await setDoc(doc(db, "users", user.uid, "books", selectedBook.id), updatedBookData, { merge: true });
        setShowLogModal(false);
    };

    const handleDeleteBook = async (id: string) => {
        if (!user) return;
        const db = getFirebaseDb();
        await deleteDoc(doc(db, "users", user.uid, "books", id));
        setShowDeleteModal(false);
    };

    const confirmDeleteBook = () => {
        if (!bookToDelete) return;
        const updatedBooks = books.filter(b => b.id !== bookToDelete);
        setBooks(updatedBooks);
        setSessions(sessions.filter(s => s.bookId !== bookToDelete));
        localStorage.setItem('reading_books_v1', JSON.stringify(updatedBooks));
        localStorage.setItem('reading_sessions_v1', JSON.stringify(sessions.filter(s => s.bookId !== bookToDelete)));
        if (selectedBookId === bookToDelete) setSelectedBookId(null);
        setShowDeleteModal(false);
        setBookToDelete(null);
        setShowEditModal(false);
    };
    const handleEditBook = () => {
        if (!selectedBook || !newBook.title || !newBook.totalPage) return;
        const updatedBooks = books.map(b => {
            if (b.id === selectedBook.id) {
                return {
                    ...b,
                    title: newBook.title!,
                    author: newBook.author || "Unknown",
                    totalPage: Number(newBook.totalPage),
                    coverColor: newBook.coverColor || "#3b82f6",
                    coverImage: newBook.coverImage,
                };
            }
            return b;
        });
        setBooks(updatedBooks);
        setShowEditModal(false);
    };

    // Open Log Modal logic
    const openLogModal = () => {
        if (!selectedBook) return;
        // Find last session for start page
        const bookSessions = sessions.filter(s => s.bookId === selectedBook.id);
        const lastPage = bookSessions.length > 0
            ? Math.max(...bookSessions.map(s => s.endPage))
            : 0;

        setNewLog({
            date: format(new Date(), 'yyyy-MM-dd'),
            startPage: lastPage + 1,
            endPage: lastPage + 1
        });
        setShowLogModal(true);
    };

    const openEditModal = () => {
        if (!selectedBook) return;
        setNewBook({
            title: selectedBook.title,
            author: selectedBook.author,
            totalPage: selectedBook.totalPage,
            coverColor: selectedBook.coverColor,
            coverImage: selectedBook.coverImage,
        });
        setShowEditModal(true);
    };

    // Render Main View (Bookshelf)
    if (!selectedBookId) {
        return (
            <div className="w-full py-6 space-y-8 animate-in fade-in duration-700 pb-20">
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white">
                            <ChevronLeft className="w-6 h-6" />
                        </Link>
                        <h1 className="text-[2.6rem] md:text-[3.1rem] font-black text-white tracking-tighter flex items-center gap-5 uppercase bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-transparent">
                            독서 대시보드
                            <div className="w-4 h-4 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_20px_rgba(79,70,229,0.7)]" />
                        </h1>
                    </div>
                    <button
                        onClick={() => {
                            setNewBook({ title: "", author: "", totalPage: 0, coverColor: "#3b82f6", coverImage: "", status: "READING", startDate: new Date() });
                            setShowAddModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-500/20"
                    >
                        <Plus className="w-4 h-4" /> 새 책 추가
                    </button>
                </header>

                {/* Monthly Goal Summary */}
                <section className="bg-white/5 rounded-3xl p-8 border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <BookIcon className="w-32 h-32" />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-2">
                            <h2 className="text-base font-black text-white/40 tracking-widest uppercase">월간 독서 목표</h2>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-white">{stats.completedCount}</span>
                                <span className="text-xl font-bold text-white/40">/ {monthlyGoal} 권</span>
                            </div>
                        </div>
                        <div className="flex-1 max-w-md space-y-2">
                            <div className="flex justify-between text-xs font-bold text-white/60">
                                <span>진행률</span>
                                <span>{progressPercentage}%</span>
                            </div>
                            <div className="h-4 bg-black/20 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercentage}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Book Gallery (Shelf) - Refactored Layout */}
                <div className="space-y-12">
                    {/* 1. Currently Reading (Hero) */}
                    {books.some(b => b.status === "READING") && (
                        <section className="space-y-6">
                            <h3 className="text-2xl font-black text-white px-2 tracking-widest uppercase flex items-center gap-3">
                                <BookOpen className="w-6 h-6 text-blue-400" /> Reading Now
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {books.filter(b => b.status === "READING").map((book) => (
                                    <motion.div
                                        key={book.id}
                                        layoutId={`book-${book.id}`}
                                        onClick={() => setSelectedBookId(book.id)}
                                        className="bg-white/5 rounded-[32px] p-6 border border-white/5 hover:border-white/10 transition-all group cursor-pointer flex gap-6"
                                    >
                                        <div className="w-32 aspect-[2/3] rounded-r-xl rounded-l-sm shadow-2xl relative overflow-hidden shrink-0"
                                            style={{
                                                backgroundColor: book.coverImage ? 'transparent' : book.coverColor,
                                                backgroundImage: book.coverImage ? `url(${book.coverImage})` : undefined,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center'
                                            }}
                                        >
                                            {!book.coverImage && (
                                                <div className="absolute left-0 top-0 bottom-0 w-2 bg-black/20 z-10 box-border border-r border-white/5" />
                                            )}
                                        </div>
                                        <div className="flex-1 flex flex-col justify-between py-2">
                                            <div className="space-y-2">
                                                <h4 className="text-xl font-black text-white leading-tight line-clamp-2">{book.title}</h4>
                                                <p className="text-sm font-bold text-white/40">{book.author}</p>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-2xl font-black text-blue-400">{Math.round((book.currentPage / book.totalPage) * 100)}%</span>
                                                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{book.currentPage} / {book.totalPage}p</span>
                                                </div>
                                                <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                                        style={{ width: `${(book.currentPage / book.totalPage) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 2. Monthly Completed */}
                    {books.some(b => b.status === "COMPLETED" && b.completedDate && isSameMonth(b.completedDate, selectedDate)) && (
                        <section className="space-y-6">
                            <h3 className="text-lg font-black text-white px-2 tracking-widest uppercase flex items-center gap-2">
                                <Plus className="w-5 h-5 text-emerald-400" /> This Month's Finish
                            </h3>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                {books.filter(b => b.status === "COMPLETED" && b.completedDate && isSameMonth(b.completedDate, selectedDate)).map((book) => (
                                    <motion.div
                                        key={book.id}
                                        layoutId={`book-${book.id}`}
                                        onClick={() => setSelectedBookId(book.id)}
                                        className="group cursor-pointer space-y-3"
                                    >
                                        <div className="aspect-[2/3] rounded-r-xl rounded-l-sm shadow-xl relative overflow-hidden"
                                            style={{
                                                backgroundColor: book.coverImage ? 'transparent' : book.coverColor,
                                                backgroundImage: book.coverImage ? `url(${book.coverImage})` : undefined,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center'
                                            }}
                                        >
                                            <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                                <div className="bg-emerald-500 text-white rounded-full p-3 shadow-lg">
                                                    <BookOpen className="w-6 h-6" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="px-1 text-center">
                                            <h4 className="text-sm font-black text-white/90 line-clamp-1 group-hover:text-emerald-400 transition-colors">{book.title}</h4>
                                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-tight">{format(book.completedDate!, 'M월 d일 완독', { locale: ko })}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 3. History (All Completed excluding current month?) No, let's show all history here */}
                    {books.some(b => b.status === "COMPLETED") && (
                        <section className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-lg font-black text-white tracking-widest uppercase flex items-center gap-2">
                                    <BarChart2 className="w-5 h-5 text-indigo-400" /> Reading History
                                </h3>
                                {books.filter(b => b.status === "COMPLETED").length > 3 && (
                                    <button
                                        onClick={() => setShowHistoryModal(true)}
                                        className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 tracking-widest uppercase transition-colors"
                                    >
                                        전체 내역 보기
                                    </button>
                                )}
                            </div>
                            <div className="bg-white/5 rounded-3xl border border-white/5 overflow-hidden">
                                <div className="divide-y divide-white/5">
                                    {books
                                        .filter(b => b.status === "COMPLETED")
                                        .sort((a, b) => (b.completedDate?.getTime() || 0) - (a.completedDate?.getTime() || 0))
                                        .slice(0, 3)
                                        .map((book) => (
                                            <div
                                                key={book.id}
                                                onClick={() => setSelectedBookId(book.id)}
                                                className="p-6 hover:bg-white/[0.02] flex items-center justify-between group cursor-pointer"
                                            >
                                                <div className="flex items-center gap-6">
                                                    <div className="w-12 h-16 rounded-sm shadow-lg overflow-hidden shrink-0"
                                                        style={{
                                                            backgroundColor: book.coverImage ? 'transparent' : book.coverColor,
                                                            backgroundImage: book.coverImage ? `url("${book.coverImage}")` : undefined,
                                                            backgroundSize: 'cover',
                                                            backgroundPosition: 'center'
                                                        }}
                                                    />
                                                    <div>
                                                        <h4 className="text-base font-black text-white">{book.title}</h4>
                                                        <p className="text-xs font-bold text-white/30">{book.author} · {book.totalPage}p</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="text-right">
                                                        <div className="text-xs font-black text-white/40 uppercase tracking-widest">Completed</div>
                                                        <div className="text-sm font-bold text-white">{book.completedDate ? format(book.completedDate, 'yyyy.MM.dd') : '-'}</div>
                                                    </div>
                                                    <ArrowLeft className="w-5 h-5 text-white/10 group-hover:text-white/40 rotate-180 transition-colors" />
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* 4. Reading Activity Calendar */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-lg font-black text-white tracking-widest uppercase flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-purple-400" /> Reading Activity
                            </h3>
                            <div className="flex items-center gap-4 bg-white/5 rounded-2xl px-4 py-2 border border-white/5">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDate(subMonths(selectedDate, 1));
                                    }}
                                    className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <span className="text-sm font-black text-white px-2">
                                    {format(selectedDate, 'yyyy. MM')}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDate(addMonths(selectedDate, 1));
                                    }}
                                    className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-[40px] p-8 border border-white/5">
                            <div className="grid grid-cols-7 gap-4">
                                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                                    <div key={day} className="text-center text-[10px] font-black text-white/20 tracking-widest pb-4">
                                        {day}
                                    </div>
                                ))}
                                {calendarDays.map((day, idx) => {
                                    const daySessions = sessions.filter(s => isSameDay(new Date(s.date), day));
                                    const totalPages = daySessions.reduce((sum, s) => sum + s.amount, 0);
                                    const isCurrentMonth = isSameMonth(day, selectedDate);
                                    const isToday = isSameDay(day, new Date());

                                    return (
                                        <div
                                            key={idx}
                                            className={`aspect-square rounded-2xl border transition-all p-2 relative group ${isCurrentMonth
                                                ? 'bg-white/5 border-white/5 hover:border-white/10'
                                                : 'bg-transparent border-transparent opacity-20'
                                                } ${isToday ? 'ring-2 ring-blue-500/50 border-blue-500/50' : ''}`}
                                        >
                                            <span className={`text-xs font-bold ${isCurrentMonth ? 'text-white/40' : 'text-white/10'}`}>
                                                {format(day, 'd')}
                                            </span>

                                            {totalPages > 0 && isCurrentMonth && (
                                                <div className="absolute inset-x-2 bottom-3 space-y-2">
                                                    <div className="flex -space-x-3 overflow-hidden items-center justify-center">
                                                        {daySessions.slice(0, 3).map((session, sIdx) => {
                                                            const book = books.find(b => b.id === session.bookId);
                                                            return (
                                                                <div
                                                                    key={sIdx}
                                                                    className="w-11 h-14 rounded-sm shadow-xl border border-white/10 overflow-hidden shrink-0"
                                                                    style={{
                                                                        backgroundColor: book?.coverColor || '#3b82f6',
                                                                        backgroundImage: book?.coverImage ? `url("${book.coverImage}")` : undefined,
                                                                        backgroundSize: 'cover',
                                                                        backgroundPosition: 'center',
                                                                        transform: `rotate(${sIdx * 5 - 5}deg)`
                                                                    }}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="text-xs font-black text-blue-400 text-center">
                                                        {totalPages}p
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                </div>

                {/* Add Book Modal */}
                <AnimatePresence>
                    {showAddModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setShowAddModal(false)}
                                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-lg bg-[#0f172a] border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
                            >
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-black text-white">새 책 등록</h3>
                                    <button onClick={() => setShowAddModal(false)}><X className="text-white/40 hover:text-white" /></button>
                                </div>

                                <div className="space-y-4">
                                    {/* Image Preview / Input */}
                                    <div className="flex gap-4">
                                        <div
                                            className="w-24 h-36 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 relative group"
                                            style={{
                                                backgroundColor: newBook.coverColor,
                                                backgroundImage: newBook.coverImage ? `url(${newBook.coverImage})` : undefined,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center'
                                            }}
                                        >
                                            {!newBook.coverImage && <BookIcon className="text-white/20" />}
                                            <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs text-white font-bold">
                                                변경
                                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                            </label>
                                        </div>
                                        <div className="flex-1 space-y-3">
                                            <div>
                                                <label className="text-xs font-bold text-white/60 mb-1 block">표지 이미지</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="https://example.com/cover.jpg"
                                                        value={newBook.coverImage}
                                                        onChange={(e) => setNewBook({ ...newBook, coverImage: e.target.value })}
                                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                                                    />
                                                    <label className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center">
                                                        업로드
                                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                                    </label>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-white/60 mb-1 block">테마 색상</label>
                                                <div className="flex gap-2">
                                                    {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'].map(color => (
                                                        <button
                                                            key={color}
                                                            onClick={() => setNewBook({ ...newBook, coverColor: color })}
                                                            className={`w-6 h-6 rounded-full border-2 ${newBook.coverColor === color ? 'border-white' : 'border-transparent'}`}
                                                            style={{ backgroundColor: color }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-white/60 mb-1 block">제목</label>
                                        <input
                                            type="text"
                                            placeholder="책 제목을 입력하세요"
                                            value={newBook.title}
                                            onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-white/60 mb-1 block">저자</label>
                                            <input
                                                type="text"
                                                placeholder="저자 이름"
                                                value={newBook.author}
                                                onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-white/60 mb-1 block">총 페이지</label>
                                            <input
                                                type="number"
                                                placeholder="전체 페이지 수"
                                                value={newBook.totalPage || ""}
                                                onChange={(e) => setNewBook({ ...newBook, totalPage: Number(e.target.value) })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleAddBook}
                                    className="w-full py-4 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20"
                                >
                                    책 저장
                                </button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Full Reading History Modal */}
                <AnimatePresence>
                    {showHistoryModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setShowHistoryModal(false)}
                                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-[40px] p-8 shadow-2xl space-y-8 max-h-[85vh] flex flex-col"
                            >
                                <div className="flex justify-between items-center shrink-0">
                                    <h3 className="text-2xl font-black text-white tracking-tight">전체 독서 히스토리</h3>
                                    <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                                        <X className="text-white/40 hover:text-white" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                                    <div className="bg-white/5 rounded-3xl border border-white/5 divide-y divide-white/5">
                                        {books
                                            .filter(b => b.status === "COMPLETED")
                                            .sort((a, b) => (b.completedDate?.getTime() || 0) - (a.completedDate?.getTime() || 0))
                                            .map((book) => (
                                                <div
                                                    key={book.id}
                                                    onClick={() => {
                                                        setSelectedBookId(book.id);
                                                        setShowHistoryModal(false);
                                                    }}
                                                    className="p-6 hover:bg-white/[0.02] flex items-center justify-between group cursor-pointer transition-colors"
                                                >
                                                    <div className="flex items-center gap-6">
                                                        <div className="w-14 h-20 rounded-sm shadow-xl overflow-hidden shrink-0"
                                                            style={{
                                                                backgroundColor: book.coverImage ? 'transparent' : book.coverColor,
                                                                backgroundImage: book.coverImage ? `url(${book.coverImage})` : undefined,
                                                                backgroundSize: 'cover',
                                                                backgroundPosition: 'center'
                                                            }}
                                                        />
                                                        <div>
                                                            <h4 className="text-lg font-black text-white group-hover:text-indigo-400 transition-colors">{book.title}</h4>
                                                            <p className="text-sm font-bold text-white/30">{book.author} · {book.totalPage}p</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-8">
                                                        <div className="text-right">
                                                            <div className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">완독일</div>
                                                            <div className="text-base font-black text-white">
                                                                {book.completedDate ? format(book.completedDate, 'yyyy.MM.dd') : '-'}
                                                            </div>
                                                        </div>
                                                        <ArrowLeft className="w-5 h-5 text-white/10 group-hover:text-indigo-400 rotate-180 transition-colors" />
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // Render Detail View
    if (selectedBook) {
        // Filter sessions for this book
        const bookSessions = sessions.filter(s => s.bookId === selectedBook.id);
        const totalReadPages = selectedBook.currentPage;
        const remainingPages = selectedBook.totalPage - totalReadPages;
        const percentage = Math.round((totalReadPages / selectedBook.totalPage) * 100);

        return (
            <div className="space-y-8 animate-in slide-in-from-right duration-500 pb-20">
                {/* Header */}
                <header className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedBookId(null)}
                            className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white tracking-tight truncate max-w-[200px] md:max-w-md">
                            {selectedBook.title}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={openEditModal}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-xs border border-white/5 transition-all"
                        >
                            수정
                        </button>
                        <button
                            onClick={openLogModal}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-500/20"
                        >
                            <Plus className="w-4 h-4" /> 독서 기록
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Cover & Key Stats */}
                    <div className="space-y-6">
                        <motion.div
                            layoutId={`book-${selectedBook.id}`}
                            className="aspect-[2/3] rounded-r-3xl rounded-l-lg shadow-2xl relative overflow-hidden mx-auto max-w-[280px] lg:max-w-full"
                            style={{
                                backgroundColor: selectedBook.coverImage ? 'transparent' : selectedBook.coverColor,
                                backgroundImage: selectedBook.coverImage
                                    ? `url(${selectedBook.coverImage})`
                                    : `linear-gradient(45deg, rgba(0,0,0,0.1) 0%, rgba(255,255,255,0.1) 50%, rgba(0,0,0,0.1) 100%)`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                            }}
                        >
                            {!selectedBook.coverImage && (
                                <div className="absolute left-0 top-0 bottom-0 w-4 bg-black/20 z-10 box-border border-r border-white/10" />
                            )}
                            {!selectedBook.coverImage && (
                                <div className="absolute inset-0 flex flex-col justify-center items-center p-8 text-center">
                                    <h2 className="text-3xl font-black text-white/90 leading-tight mb-2">
                                        {selectedBook.title}
                                    </h2>
                                    <p className="text-sm font-bold text-white/60">
                                        {selectedBook.author}
                                    </p>
                                </div>
                            )}
                        </motion.div>

                        <div className="bg-white/5 rounded-3xl p-6 border border-white/5 space-y-6">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm font-bold text-white">
                                    <span>독서 진행률</span>
                                    <span className="text-blue-400">{percentage}%</span>
                                </div>
                                <div className="h-4 bg-black/20 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-1000"
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs font-bold text-white/40 pt-1">
                                    <span>0p</span>
                                    <span>{selectedBook.currentPage} / {selectedBook.totalPage}p</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black/20 rounded-2xl p-4 text-center">
                                    <div className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">읽은 페이지</div>
                                    <div className="text-2xl font-black text-white">{totalReadPages}</div>
                                </div>
                                <div className="bg-black/20 rounded-2xl p-4 text-center">
                                    <div className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">남은 페이지</div>
                                    <div className="text-2xl font-black text-white/60">{remainingPages}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Calendar & History */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Reading Calendar */}
                        <section className="bg-white/5 rounded-3xl p-8 border border-white/5">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-black text-white tracking-widest uppercase flex items-center gap-2">
                                    <CalendarIcon className="w-5 h-5 text-indigo-400" /> 독서 달력
                                </h3>
                                <div className="text-xs font-bold text-white/40">
                                    {format(selectedDate, 'yyyy년 M월', { locale: ko })}
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-2 mb-2">
                                {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                                    <div key={day} className="text-center text-[10px] font-black text-white/20 py-2">{day}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-2">
                                {calendarDays.map((day, i) => {
                                    const isCurrentMonth = format(day, 'M') === format(selectedDate, 'M');
                                    const daySession = bookSessions.find(s => isSameDay(s.date, day));

                                    // Calculate progress up to this day (Cumulative? Or just amount read today?)
                                    // User wants "30p / 450p" or "Gauge filling up"

                                    // Let's implement Day's End Page ratio for the gauge
                                    let progressRatio = 0;
                                    let displayAmount = null;

                                    if (daySession) {
                                        // Use cumulative end page for absolute progress
                                        progressRatio = Math.min(1, daySession.endPage / selectedBook.totalPage);
                                        displayAmount = `${daySession.amount}p`; // Daily read amount
                                    }

                                    return (
                                        <div
                                            key={day.toISOString()}
                                            className={`
                                                aspect-square rounded-2xl flex flex-col items-center justify-center relative group transition-all overflow-hidden
                                                ${!isCurrentMonth ? 'opacity-20' : ''}
                                                ${daySession ? 'border border-white/20 shadow-lg' : 'bg-white/5 border border-white/5'}
                                            `}
                                            style={daySession ? {
                                                backgroundColor: selectedBook.coverImage ? 'transparent' : selectedBook.coverColor,
                                                backgroundImage: selectedBook.coverImage ? `url("${selectedBook.coverImage}")` : undefined,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                                backgroundRepeat: 'no-repeat'
                                            } : undefined}
                                        >
                                            {/* Horizontal Bar Gauge (Bottom) */}
                                            {daySession && (
                                                <div className="absolute bottom-2 left-2 right-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-400 shadow-[0_0_5px_rgba(99,102,241,0.8)]"
                                                        style={{ width: `${progressRatio * 100}%` }}
                                                    />
                                                </div>
                                            )}

                                            <div className="relative z-10 flex flex-col items-center mb-1">
                                                <span className={`text-xs font-bold ${daySession ? 'text-white' : 'text-white/20'}`}>
                                                    {format(day, 'd')}
                                                </span>
                                                {daySession && (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[9px] font-black text-indigo-400/80">
                                                            {displayAmount}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Tooltip for detail */}
                                            {daySession && (
                                                <div className="absolute top-0 inset-x-0 p-1 bg-black/80 text-[8px] text-white text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                                    p.{daySession.endPage} ({Math.round(progressRatio * 100)}%)
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Recent Sessions List */}
                        <section>
                            <h3 className="text-sm font-black text-white/40 tracking-widest uppercase mb-4 px-2">독서 기록 히스토리</h3>
                            <div className="space-y-3">
                                {bookSessions.sort((a, b) => b.date.getTime() - a.date.getTime()).map(session => (
                                    <div key={session.id} className="bg-white/5 rounded-2xl p-4 flex justify-between items-center border border-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                                <BookIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white">
                                                    {format(session.date, 'M월 d일 (EEE)', { locale: ko })}
                                                </div>
                                                <div className="text-xs text-white/40 font-bold">
                                                    p.{session.startPage} - p.{session.endPage}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-lg font-black text-white">
                                            {session.amount} <span className="text-xs font-bold text-white/40">페이지</span>
                                        </div>
                                    </div>
                                ))}
                                {bookSessions.length === 0 && (
                                    <div className="text-center py-8 text-white/20 font-bold text-sm">
                                        아직 독서 기록이 없습니다.
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>


                {/* Log Reading Modal */}
                <AnimatePresence>
                    {showLogModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setShowLogModal(false)}
                                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-sm bg-[#0f172a] border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6"
                            >
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-black text-white">독서 기록</h3>
                                    <button onClick={() => setShowLogModal(false)}><X className="text-white/40 hover:text-white" /></button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-white/60 mb-1 block">날짜</label>
                                        <input
                                            type="date"
                                            value={newLog.date}
                                            onChange={(e) => setNewLog({ ...newLog, date: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-white/60 mb-1 block">시작 페이지</label>
                                            <input
                                                type="number"
                                                value={newLog.startPage}
                                                onChange={(e) => setNewLog({ ...newLog, startPage: Number(e.target.value) })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-white/60 mb-1 block">종료 페이지</label>
                                            <input
                                                type="number"
                                                value={newLog.endPage}
                                                onChange={(e) => setNewLog({ ...newLog, endPage: Number(e.target.value) })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 text-center">
                                        <div className="text-xs text-white/40 font-bold mb-1">읽은 양</div>
                                        <div className="text-xl font-black text-indigo-400">
                                            {Math.max(0, newLog.endPage - newLog.startPage + 1)} <span className="text-xs text-white/40">페이지</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleLogReading}
                                    className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/20"
                                >
                                    기록 저장
                                </button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Edit Book Modal */}
                <AnimatePresence>
                    {showEditModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setShowEditModal(false)}
                                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-lg bg-[#0f172a] border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
                            >
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-black text-white">책 정보 수정</h3>
                                    <button onClick={() => setShowEditModal(false)}><X className="text-white/40 hover:text-white" /></button>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <div
                                            className="w-24 h-36 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 relative group"
                                            style={{
                                                backgroundColor: newBook.coverColor,
                                                backgroundImage: newBook.coverImage ? `url(${newBook.coverImage})` : undefined,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center'
                                            }}
                                        >
                                            {!newBook.coverImage && <BookIcon className="text-white/20" />}
                                            <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs text-white font-bold">
                                                변경
                                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                            </label>
                                        </div>
                                        <div className="flex-1 space-y-3">
                                            <div>
                                                <label className="text-xs font-bold text-white/60 mb-1 block">표지 이미지</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="https://example.com/cover.jpg"
                                                        value={newBook.coverImage}
                                                        onChange={(e) => setNewBook({ ...newBook, coverImage: e.target.value })}
                                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                                                    />
                                                    <label className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center">
                                                        업로드
                                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                                    </label>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-white/60 mb-1 block">테마 색상</label>
                                                <div className="flex gap-2">
                                                    {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'].map(color => (
                                                        <button
                                                            key={color}
                                                            onClick={() => setNewBook({ ...newBook, coverColor: color })}
                                                            className={`w-6 h-6 rounded-full border-2 ${newBook.coverColor === color ? 'border-white' : 'border-transparent'}`}
                                                            style={{ backgroundColor: color }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-white/60 mb-1 block">제목</label>
                                        <input
                                            type="text"
                                            placeholder="책 제목을 입력하세요"
                                            value={newBook.title}
                                            onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-white/60 mb-1 block">저자</label>
                                            <input
                                                type="text"
                                                placeholder="저자 이름"
                                                value={newBook.author}
                                                onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-white/60 mb-1 block">총 페이지</label>
                                            <input
                                                type="number"
                                                placeholder="전체 페이지 수"
                                                value={newBook.totalPage || ""}
                                                onChange={(e) => setNewBook({ ...newBook, totalPage: Number(e.target.value) })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleEditBook}
                                    className="w-full py-4 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20"
                                >
                                    수정사항 저장
                                </button>

                                <div className="pt-4 border-t border-white/5">
                                    <button
                                        onClick={() => handleDeleteBook(selectedBook.id)}
                                        className="w-full py-3 text-red-400/60 hover:text-red-400 font-bold text-xs transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Trash2 className="w-3 h-3" /> 책 정보 영구 삭제하기
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Custom Delete Confirmation Modal */}
                <AnimatePresence>
                    {showDeleteModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setShowDeleteModal(false)}
                                className="absolute inset-0 bg-black/90 backdrop-blur-md"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="relative w-full max-w-sm bg-[#0f172a] border border-red-500/20 rounded-[40px] p-10 shadow-2xl text-center space-y-8"
                            >
                                <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-2 text-red-400">
                                    <Trash2 className="w-10 h-10" />
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-2xl font-black text-white">정말 삭제할까요?</h3>
                                    <p className="text-sm text-white/40 font-bold leading-relaxed px-4">
                                        이 책과 관련된 모든 독서 기록과 상세 데이터가 영구적으로 삭제됩니다.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-3 pt-4">
                                    <button
                                        onClick={confirmDeleteBook}
                                        className="w-full py-5 bg-red-500 hover:bg-red-400 text-white font-black rounded-3xl transition-all shadow-xl shadow-red-500/20 active:scale-95"
                                    >
                                        네, 삭제할게요
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteModal(false)}
                                        className="w-full py-4 text-white/20 font-bold hover:text-white/40 transition-colors"
                                    >
                                        아니요, 유지할게요
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        );
    }
    return null;
}
