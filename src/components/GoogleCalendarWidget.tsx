"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, ExternalLink, Loader2, CalendarX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchGoogleCalendarEvents, getTodayRange, CalendarEvent } from "@/lib/googleCalendar";
import { format, isSameDay, parseISO, isValid } from "date-fns";
import { ko } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

interface GoogleCalendarWidgetProps {
    selectedDate: Date;
}

export function GoogleCalendarWidget({ selectedDate = new Date() }: GoogleCalendarWidgetProps) {
    const { googleAccessToken, login, clearGoogleToken } = useAuth();
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getSafeDate = (d: any) => {
        if (!d) return new Date();
        const parsed = d instanceof Date ? d : new Date(d);
        return isValid(parsed) ? parsed : new Date();
    };

    const safeSelectedDate = getSafeDate(selectedDate);

    useEffect(() => {
        async function loadEvents() {
            if (!googleAccessToken) return;

            setIsLoading(true);
            setError(null);

            try {
                // Use safeSelectedDate instead of just today
                const start = new Date(safeSelectedDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(safeSelectedDate);
                end.setHours(23, 59, 59, 999);

                const fetchedEvents = await fetchGoogleCalendarEvents(googleAccessToken, start, end);
                setEvents(fetchedEvents);
            } catch (err: any) {
                console.error("Error loading events:", err);
                if (err.message === "UNAUTHORIZED_CALENDAR_ACCESS") {
                    clearGoogleToken();
                    setError("인증 세션이 만료되었습니다. 다시 로그인해주세요.");
                } else if (err.message === "FORBIDDEN_CALENDAR_ACCESS") {
                    setError("일정 접근 권한이 없습니다. 로그인 시 모든 권한을 허용했는지 확인해주세요.");
                } else if (err.message === "API_NOT_ENABLED") {
                    setError("Google Calendar API가 활성화되지 않았습니다. 관리자 설정에서 API를 활성화해야 합니다.");
                } else {
                    setError(err.message || "일정을 불러오지 못했습니다.");
                }
            } finally {
                setIsLoading(false);
            }
        }

        loadEvents();
    }, [googleAccessToken, selectedDate, clearGoogleToken]);

    if (!googleAccessToken) {
        return (
            <div className="glass p-6 space-y-4 border-white/5">
                <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-accent" />
                    <h4 className="text-base font-bold text-white/80">오늘의 일정</h4>
                </div>
                <div className="text-center py-4 space-y-4">
                    <p className="text-xs text-white/40 leading-relaxed">
                        구글 캘린더를 연동하여<br />정민혁님의 오늘 일정을 확인해보세요.
                    </p>
                    <button
                        onClick={() => login()}
                        className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all text-accent"
                    >
                        구글 캘린더 연동하기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="glass p-6 space-y-4 border-accent/20">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-base font-bold text-white/80 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-accent" />
                    오늘의 일정
                </h4>
                {isLoading && <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />}
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                <AnimatePresence mode="popLayout">
                    {error ? (
                        <div className="flex flex-col items-center justify-center py-4 px-2 text-center bg-red-500/5 rounded-xl border border-red-500/10">
                            <p className="text-[11px] text-red-400 leading-relaxed mb-3">
                                {error}
                            </p>
                            {error.includes("활성화") ? (
                                <a
                                    href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-xs font-bold text-red-400 transition-all flex items-center gap-2"
                                >
                                    API 활성화하러 가기 <ExternalLink className="w-3 h-3" />
                                </a>
                            ) : (error.includes("인증") || error.includes("권한") || error.includes("접근")) && (
                                <button
                                    onClick={() => login()}
                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-xs font-bold text-red-400 transition-all"
                                >
                                    다시 로그인하여 연동하기
                                </button>
                            )}
                        </div>
                    ) : events.length > 0 ? (
                        events.map((event, idx) => {
                            const dateStr = event.start.dateTime || event.start.date;
                            let startTime = "종일";

                            if (event.start.dateTime) {
                                try {
                                    const date = parseISO(event.start.dateTime);
                                    if (isValid(date)) {
                                        startTime = format(date, 'HH:mm');
                                    }
                                } catch (e) {
                                    console.error("Invalid date format:", event.start.dateTime);
                                }
                            }

                            return (
                                <motion.div
                                    key={event.id || idx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-accent/20 transition-all group"
                                >
                                    <div className="flex flex-col gap-1">
                                        <h5 className="text-sm font-bold text-white/90 truncate group-hover:text-accent transition-colors">
                                            {event.summary}
                                        </h5>
                                        <div className="flex items-center gap-2 text-[10px] text-white/30">
                                            <Clock className="w-2.5 h-2.5" />
                                            <span>{startTime}</span>
                                            {event.location && (
                                                <span className="truncate max-w-[100px] ml-1 opacity-70">
                                                    • {event.location}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })
                    ) : !isLoading ? (
                        <div className="flex flex-col items-center justify-center py-6 text-white/20 border border-dashed border-white/5 rounded-xl">
                            <CalendarX className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-xs">{isSameDay(safeSelectedDate, new Date()) ? "오늘 " : format(safeSelectedDate, 'M/d')} 일정이 없습니다</p>
                        </div>
                    ) : null}
                </AnimatePresence>
            </div>

            <a
                href="https://calendar.google.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-2 text-[11px] font-bold text-white/20 hover:text-white transition-all group"
            >
                Google Calendar 열기
                <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
        </div>
    );
}
