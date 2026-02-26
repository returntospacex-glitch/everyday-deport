import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, differenceInDays } from 'date-fns';

export type BookStatus = 'READING' | 'COMPLETED' | 'PAUSED';

export interface Book {
    id: string;
    title: string;
    author: string;
    totalPage: number;
    currentPage: number; // Calculated from sessions
    status: BookStatus;
    coverColor: string; // Hex color for UI
    coverImage?: string; // URL for book cover
    description?: string; // Short description or memo
    startDate: Date;
    completedDate?: Date;
}

export interface ReadingSession {
    id: string;
    bookId: string;
    date: Date;
    startPage: number;
    endPage: number;
    amount: number; // endPage - startPage + 1
}

// Mock Data
export const initialBooks: Book[] = [
    {
        id: '1',
        title: '클린 코드',
        author: '로버트 C. 마틴',
        totalPage: 450,
        currentPage: 150,
        status: 'READING',
        coverColor: '#3b82f6', // blue-500
        startDate: new Date(2026, 1, 10), // Feb 10, 2026
    },
    {
        id: '2',
        title: '프로그래머의 뇌',
        author: '펠리너 헤르만스',
        totalPage: 280,
        currentPage: 280,
        status: 'COMPLETED',
        coverColor: '#8b5cf6', // violet-500
        startDate: new Date(2026, 1, 1),
        completedDate: new Date(2026, 1, 15),
    }
];

export const initialSessions: ReadingSession[] = [
    { id: '1', bookId: '1', date: new Date(2026, 1, 10), startPage: 1, endPage: 30, amount: 30 },
    { id: '2', bookId: '1', date: new Date(2026, 1, 11), startPage: 31, endPage: 50, amount: 20 },
    { id: '3', bookId: '1', date: new Date(2026, 1, 19), startPage: 51, endPage: 150, amount: 100 },
    { id: '4', bookId: '2', date: new Date(2026, 1, 1), startPage: 1, endPage: 100, amount: 100 },
    { id: '5', bookId: '2', date: new Date(2026, 1, 5), startPage: 101, endPage: 200, amount: 100 },
    { id: '6', bookId: '2', date: new Date(2026, 1, 15), startPage: 201, endPage: 280, amount: 80 },
];

// Helper Functions

export const getMonthlyReadingStats = (books: Book[], sessions: ReadingSession[], targetDate: Date) => {
    const start = startOfMonth(targetDate);
    const end = endOfMonth(targetDate);

    // Completed Books in this month
    const completedBooks = books.filter(b =>
        b.status === 'COMPLETED' &&
        b.completedDate &&
        b.completedDate >= start &&
        b.completedDate <= end
    );

    // Total Pages read in this month
    const monthlySessions = sessions.filter(s => s.date >= start && s.date <= end);
    const totalPages = monthlySessions.reduce((acc, cur) => acc + cur.amount, 0);

    return {
        completedCount: completedBooks.length,
        totalPages,
        monthlySessions // For calendar visualization
    };
};

export const getBookProgress = (book: Book) => {
    return Math.round((book.currentPage / book.totalPage) * 100);
};

export const getDailyTotalPages = (sessions: ReadingSession[], date: Date) => {
    return sessions
        .filter(s => isSameDay(s.date, date))
        .reduce((acc, cur) => acc + cur.amount, 0);
};
