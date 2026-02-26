
import { addDays, format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";

export type ExerciseType = "웨이트" | "유산소" | "런닝" | "기타";

export interface ExerciseRecord {
    id: string;
    date: Date;
    type: ExerciseType;
    subTypes?: string[]; // 다중 선택 가능하도록 변경
    duration: number; // minutes
    calories?: number;
    intensity: "낮음" | "보통" | "높음";
    notes?: string;
    distance?: number; // 런닝 거리 (km)
    pace?: string;     // 런닝 페이스 (00'00")
}

export interface ExerciseGoal {
    weeklyTarget: number; // 주간 목표 횟수
    monthlyTarget: number; // 월간 목표 횟수
}

export interface BodyMetricRecord {
    id: string;
    date: Date;
    weight: number;      // 몸무게 (kg)
    muscleMass: number;  // 근육량 (kg)
    bodyFat: number;     // 체지방률 (%)
    fatMass?: number;    // 체지방량 (kg)
}

export interface BodyMetricGoal {
    targetWeight: number;
    targetMuscleMass: number;
    targetBodyFat: number;
    targetFatMass?: number; // 체지방량 (kg) 목표 추가
    deadline?: string; // ISO string format for storage
    startDate?: string; // ISO string format for storage
}

// Mock Data Generation
const generateMockExerciseData = (): ExerciseRecord[] => {
    // 2026-02-19 이후 랜덤 데이터 생성 중단 요청 반영
    // 더 이상의 랜덤 데이터 생성이 필요 없으므로 빈 배열 반환
    return [];
    /* 기존 로직 (참고용)
    const today = new Date();
    ...
    */
};

export const exerciseRecords: ExerciseRecord[] = generateMockExerciseData();

export const getExerciseRecord = (date: Date) => {
    return exerciseRecords.find(record => isSameDay(record.date, date));
};

// 특정 기간의 운동 횟수 및 타입별 카운트 계산
export const getExerciseStatsByPeriod = (records: ExerciseRecord[], start: Date, end: Date) => {
    const periodRecords = records.filter(r => r.date >= start && r.date <= end);

    // Get unique dates for total count
    const uniqueDates = new Set(periodRecords.map(r => format(r.date, 'yyyy-MM-dd')));

    // Get unique dates per type
    const gymDates = new Set(periodRecords.filter(r => r.type === "웨이트" || r.type === "유산소").map(r => format(r.date, 'yyyy-MM-dd')));
    const runningDates = new Set(periodRecords.filter(r => r.type === "런닝").map(r => format(r.date, 'yyyy-MM-dd')));
    const otherDates = new Set(periodRecords.filter(r => r.type === "기타").map(r => format(r.date, 'yyyy-MM-dd')));

    return {
        total: uniqueDates.size,
        gymCount: gymDates.size,
        runningCount: runningDates.size,
        otherCount: otherDates.size
    };
};

// 통계 요약 데이터 가져오기
export const getExerciseAdvancedStats = (records: ExerciseRecord[], targetDate: Date = new Date()) => {
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);

    // 이번달 vs 저번달
    const lastMonthStart = startOfMonth(addDays(monthStart, -1));
    const lastMonthEnd = endOfMonth(addDays(monthStart, -1));

    const thisMonth = getExerciseStatsByPeriod(records, monthStart, monthEnd);
    const lastMonth = getExerciseStatsByPeriod(records, lastMonthStart, lastMonthEnd);

    // 이번주 vs 저번주
    const weekStart = addDays(targetDate, -6);
    const lastWeekStart = addDays(weekStart, -7);
    const lastWeekEnd = addDays(weekStart, -1);

    const thisWeek = getExerciseStatsByPeriod(records, weekStart, targetDate);
    const lastWeek = getExerciseStatsByPeriod(records, lastWeekStart, lastWeekEnd);

    return {
        thisMonthCount: thisMonth.total,
        lastMonthCount: lastMonth.total,
        thisWeekCount: thisWeek.total,
        lastWeekCount: lastWeek.total,
        thisMonthGymCount: thisMonth.gymCount,
        thisMonthRunningCount: thisMonth.runningCount,
        thisMonthOtherCount: thisMonth.otherCount,
        thisWeekGymCount: thisWeek.gymCount,
        thisWeekRunningCount: thisWeek.runningCount,
        thisWeekOtherCount: thisWeek.otherCount,
        monthDiff: thisMonth.total - lastMonth.total,
        weekDiff: thisWeek.total - lastWeek.total
    };
};

export const getMonthlyExerciseStats = (records: ExerciseRecord[], monthStart: Date) => {
    const start = startOfMonth(monthStart);
    const end = endOfMonth(monthStart);
    const filteredRecords = records.filter(r => r.date >= start && r.date <= end);

    if (filteredRecords.length === 0) return { totalMinutes: 0, totalCalories: 0, count: 0, avgMinutes: "0" };

    const totalMinutes = filteredRecords.reduce((acc, cur) => acc + cur.duration, 0);
    const totalCalories = filteredRecords.reduce((acc, cur) => acc + (cur.calories || 0), 0);
    const uniqueDays = new Set(filteredRecords.map(r => format(r.date, 'yyyy-MM-dd'))).size;

    return {
        totalMinutes,
        totalCalories,
        count: uniqueDays,
        avgMinutes: uniqueDays > 0 ? (totalMinutes / uniqueDays).toFixed(0) : "0"
    };
};

export const mergeExerciseRecords = (mock: ExerciseRecord[], saved: ExerciseRecord[]): ExerciseRecord[] => {
    const mergedMap = new Map<string, ExerciseRecord>();

    // 1. Add Mock Data
    mock.forEach(r => mergedMap.set(r.id, r));

    // 2. Overwrite/Add Saved Data (by ID)
    saved.forEach(r => mergedMap.set(r.id, r));

    // 3. Convert to Array and Sort by Date
    return Array.from(mergedMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
};
