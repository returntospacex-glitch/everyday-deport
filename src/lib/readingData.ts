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
export const initialBooks: Book[] = [];

export const initialSessions: ReadingSession[] = [];

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
