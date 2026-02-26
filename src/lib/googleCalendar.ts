import { format } from 'date-fns';

export interface CalendarEvent {
    id: string;
    summary: string;
    start: {
        dateTime?: string;
        date?: string;
    };
    end: {
        dateTime?: string;
        date?: string;
    };
    description?: string;
    location?: string;
}

export async function fetchGoogleCalendarEvents(accessToken: string, timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
    const timeMinStr = timeMin.toISOString();
    const timeMaxStr = timeMax.toISOString();

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMinStr}&timeMax=${timeMaxStr}&singleEvents=true&orderBy=startTime`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Google Calendar API Raw Error Body:", errorText);

            let errorDetail = errorText;
            try {
                const errorData = JSON.parse(errorText);
                errorDetail = errorData.error?.message || errorText;
            } catch (e) {
                // Not JSON
            }

            console.error("Google Calendar API Error Summary:", {
                status: response.status,
                statusText: response.statusText,
                detail: errorDetail
            });

            if (response.status === 401) {
                throw new Error("UNAUTHORIZED_CALENDAR_ACCESS");
            }
            if (response.status === 403) {
                if (errorDetail.toLowerCase().includes("not enabled")) {
                    throw new Error("API_NOT_ENABLED");
                }
                throw new Error("FORBIDDEN_CALENDAR_ACCESS");
            }

            throw new Error(`Failed to fetch calendar events: ${response.status} ${errorDetail || response.statusText}`);
        }

        const data = await response.json();
        return data.items || [];
    } catch (error: any) {
        // Rethrow specialized error for the component to handle
        if (error.message === "UNAUTHORIZED_CALENDAR_ACCESS" || error.message === "FORBIDDEN_CALENDAR_ACCESS") {
            throw error;
        }
        console.error("Error fetching Google Calendar events:", error);
        throw error; // Rethrow to let the UI show the error state
    }
}

export function getTodayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    return { start, end };
}

export function getMonthRange(date: Date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
}
