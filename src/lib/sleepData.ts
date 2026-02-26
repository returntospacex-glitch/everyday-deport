
import { addDays, format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";

export interface SleepRecord {
    date: Date;
    bedTime: Date;
    wakeTime: Date;
    quality: 1 | 2 | 3 | 4; // 1: Poor, 4: Excellent
    duration: number; // hours
}

// Generate mock data for the current month and previous month
const generateMockData = (): SleepRecord[] => {
    return [];
};

export const sleepRecords: SleepRecord[] = generateMockData();

export const getSleepRecord = (date: Date) => {
    return sleepRecords.find(record => isSameDay(record.date, date));
};

export const getMonthlySleepStats = (monthStart: Date, customRecords: SleepRecord[] = sleepRecords) => {
    const start = startOfMonth(monthStart);
    const end = endOfMonth(monthStart);
    const records = customRecords.filter(r => r.date >= start && r.date <= end);

    if (records.length === 0) return { avgDuration: "0.0", avgQuality: "0", totalRecords: 0, weeklyBreakdown: [] };

    const totalDuration = records.reduce((acc, cur) => acc + cur.duration, 0);
    const totalQuality = records.reduce((acc, cur) => acc + cur.quality, 0);

    // 주차별 평균 계산 (1-7, 8-14, 15-21, 22-말일)
    const weeks = [
        records.filter(r => r.date.getDate() <= 7),
        records.filter(r => r.date.getDate() > 7 && r.date.getDate() <= 14),
        records.filter(r => r.date.getDate() > 14 && r.date.getDate() <= 21),
        records.filter(r => r.date.getDate() > 21)
    ];

    const weeklyBreakdown = weeks.map((weekRecords, i) => {
        if (weekRecords.length === 0) return { week: `${i + 1}주차`, avg: 0 };
        const avg = weekRecords.reduce((acc, cur) => acc + cur.duration, 0) / weekRecords.length;
        return { week: `${i + 1}주차`, avg: parseFloat(avg.toFixed(1)) };
    });

    return {
        avgDuration: (totalDuration / records.length).toFixed(1),
        avgQuality: (totalQuality / records.length).toFixed(1),
        totalRecords: records.length,
        weeklyBreakdown
    };
};
