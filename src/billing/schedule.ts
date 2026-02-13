import { ClientBillingConfig } from "@/types/client";

/**
 * Computes the next run timestamp for a given billing schedule.
 * 
 * @param config The full billing configuration
 * @param fromDate The reference date (usually 'now' or 'lastRunAt')
 * @returns Date object representing the next run time, or null if schedule is invalid/ended
 */
export function computeNextRunAt(config: ClientBillingConfig, fromDate: Date = new Date()): Date | null {
    const schedule = config.schedule;
    if (!schedule.autoInvoiceEnabled) return null;
    if (schedule.endDate && new Date(schedule.endDate) < fromDate) return null;
    if (schedule.startDate && new Date(schedule.startDate) > fromDate) {
        // If start date is in future, we start calculating FROM start date?
        // Or just return start date if it matches rules?
        // Simplest: if fromDate < startDate, set fromDate = startDate
        fromDate = new Date(schedule.startDate);
    }

    const { frequency, timeOfDay, timezone, dayOfWeek, dayOfMonth } = schedule;
    const [targetHour, targetMinute] = timeOfDay.split(':').map(Number);

    // Helper to get time parts in target timezone
    const getParts = (d: Date) => {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            weekday: 'short',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
        });
        const parts = formatter.formatToParts(d);
        const map = new Map(parts.map(p => [p.type, p.value]));
        return {
            year: parseInt(map.get('year')!),
            month: parseInt(map.get('month')!) - 1,
            day: parseInt(map.get('day')!),
            hour: parseInt(map.get('hour')!) % 24,
            minute: parseInt(map.get('minute')!),
            weekday: d.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'short' })
        };
    };

    const createDateInZone = (year: number, month: number, day: number, hour: number, minute: number): Date => {
        const utcDate = new Date(Date.UTC(year, month, day, hour, minute));
        for (let i = 0; i < 3; i++) {
            const parts = getParts(utcDate);
            const partsDate = new Date(Date.UTC(parts.year, parts.month, parts.day, parts.hour, parts.minute));
            const diff = partsDate.getTime() - Date.UTC(year, month, day, hour, minute);
            if (Math.abs(diff) < 1000) return utcDate;
            utcDate.setTime(utcDate.getTime() - diff);
        }
        return utcDate;
    };

    const nowParts = getParts(fromDate);

    // Start with today at target time
    let candidateInZone = createDateInZone(nowParts.year, nowParts.month, nowParts.day, targetHour, targetMinute);

    // Search forward
    let safety = 366;
    while (safety-- > 0) {
        // If candidate is <= fromDate, must advance
        if (candidateInZone.getTime() <= fromDate.getTime()) {
            candidateInZone = new Date(candidateInZone.getTime() + 24 * 60 * 60 * 1000);
        }

        const p = getParts(candidateInZone);
        let matches = true;

        if (frequency === 'weekly') {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const currentDayOfWeek = days.indexOf(p.weekday);
            if (currentDayOfWeek !== dayOfWeek) matches = false;
        }

        if (frequency === 'monthly') {
            if (p.day !== dayOfMonth) matches = false;
        }

        if (matches) {
            return createDateInZone(p.year, p.month, p.day, targetHour, targetMinute);
        }

        // Advance logic
        if (frequency === 'monthly') {
            // To optimize: if current day < target day, jump to target day. Else next month.
            // But simple daily increment is safest for now.
            candidateInZone = new Date(candidateInZone.getTime() + 24 * 60 * 60 * 1000);
        } else {
            candidateInZone = new Date(candidateInZone.getTime() + 24 * 60 * 60 * 1000);
        }
    }

    return null;
}
