
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
    const today = new Date();
    const start = addDays(today, -60);

    // 2026-02-19 이후로는 랜덤 데이터 생성 중단 (사용자 요청)
    const cutoffDate = new Date(2026, 1, 18); // Month is 0-indexed (1 = Feb)
    const end = today < cutoffDate ? today : cutoffDate;

    const days = eachDayOfInterval({ start, end });

    return days.map(day => {
        // 특정 기간 (1/22 - 2/11) 데이터 강제 설정
        const targetStart = new Date(2026, 0, 22);
        const targetEnd = new Date(2026, 1, 11);

        let bedHour, bedMinute, wakeHour, wakeMinute;

        if (day >= targetStart && day <= targetEnd) {
            // 사용자 요청: 10:15 PM 취침
            bedHour = 22;
            bedMinute = 15;

            // 주말(토, 일) 구분: getDay() 0:일, 6:토
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            if (isWeekend) {
                wakeHour = 7;
                wakeMinute = 0;
            } else {
                wakeHour = 6;
                wakeMinute = 0;
            }
        } else {
            // 그 외 기간은 기존처럼 랜덤 생성
            bedHour = 22 + Math.floor(Math.random() * 3); // 22, 23, 24 (0)
            bedMinute = Math.floor(Math.random() * 60);
            wakeHour = 6 + Math.floor(Math.random() * 3); // 6, 7, 8
            wakeMinute = Math.floor(Math.random() * 60);
        }

        const bedTime = new Date(day);
        bedTime.setHours(bedHour, bedMinute);

        const wakeTime = addDays(new Date(day), 1);
        wakeTime.setHours(wakeHour, wakeMinute);

        const duration = (wakeTime.getTime() - bedTime.getTime()) / (1000 * 60 * 60);
        const quality = duration > 7.5 ? 4 : duration > 6.5 ? 3 : duration > 5.5 ? 2 : 1;

        return {
            date: day,
            bedTime,
            wakeTime,
            quality: quality as 1 | 2 | 3 | 4,
            duration: Number(duration.toFixed(1))
        };
    });
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
