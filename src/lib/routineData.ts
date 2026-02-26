import { startOfMonth, subDays, format } from "date-fns";

export interface MealRecord {
    id: string;
    date: Date;
    type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    menu: string;
    calories?: number;
    photo?: string;
}

export interface ReadingRecord {
    id: string;
    date: Date;
    bookTitle: string;
    pagesRead: number;
    duration: number; // minutes
    notes?: string;
}

export interface DailyRecord {
    id: string;
    date: Date;
    mood: string; // emoji or text
    highlight: string;
    gratitude: string;
    memo?: string;
}

// Mock Data
export const mealRecords: MealRecord[] = [
    { id: 'm1', date: new Date(), type: 'breakfast', menu: '샐러드와 닭가슴살', calories: 350 },
    { id: 'm2', date: new Date(), type: 'lunch', menu: '김치찌개와 공기밥', calories: 600 },
];

export const readingRecords: ReadingRecord[] = [
    { id: 'r1', date: new Date(), bookTitle: '클린 코드', pagesRead: 30, duration: 45 },
    { id: 'r2', date: subDays(new Date(), 1), bookTitle: '딥 워크', pagesRead: 50, duration: 60 },
];

export const dailyRecords: DailyRecord[] = [
    {
        id: 'd1',
        date: new Date(),
        mood: '😊',
        highlight: '새로운 기능을 성공적으로 기획함',
        gratitude: '오늘도 건강하게 하루를 보낼 수 있음에 감사'
    },
];
