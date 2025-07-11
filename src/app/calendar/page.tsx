"use client";

import { useUser } from "@/context/UserContext";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/button";

const priorities = {
  emergency: "bg-red-500 text-white",
  urgent: "bg-orange-500 text-white",
  high: "bg-orange-400 text-white",
  medium: "bg-yellow-300 text-black",
  low: "bg-green-300 text-black",
};

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

export default function CalendarPage() {
  const { profile } = useUser();
  const today = new Date();
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [meetings, setMeetings] = useState<unknown[]>([]);
  const [tasks, setTasks] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const days = getMonthDays(current.year, current.month);
  const firstDayOfWeek = new Date(current.year, current.month, 1).getDay();

  useEffect(() => {
    if (!profile?.group_id) return;
    setLoading(true);
    setError("");
    const monthStart = new Date(current.year, current.month, 1).toISOString();
    const monthEnd = new Date(current.year, current.month + 1, 0, 23, 59, 59, 999).toISOString();
    Promise.all([
      supabase.from("meetings").select().eq("group_id", profile.group_id)
        .gte("start_time", monthStart).lte("start_time", monthEnd),
      supabase.from("tasks").select().eq("group_id", profile.group_id)
        .gte("due_date", monthStart).lte("due_date", monthEnd),
    ]).then(([meetingsRes, tasksRes]) => {
      if (meetingsRes.error) setError(meetingsRes.error.message);
      else setMeetings(meetingsRes.data || []);
      if (tasksRes.error) setError(tasksRes.error.message);
      else setTasks(tasksRes.data || []);
      setLoading(false);
    });
  }, [profile?.group_id, current.year, current.month]);

  function getEventsForDay(day: Date) {
    const dayStr = day.toISOString().slice(0, 10);
    const meetingsForDay = meetings.filter((m: unknown) => (m as any).start_time && (m as any).start_time.slice(0, 10) === dayStr);
    const tasksForDay = tasks.filter((t: unknown) => (t as any).due_date && (t as any).due_date.slice(0, 10) === dayStr);
    return { meetings: meetingsForDay, tasks: tasksForDay };
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-6">
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-4">
          <BackButton />
          <h1 className="text-3xl font-bold">Calendar</h1>
          <Button className="bg-gradient-to-r from-blue-500 to-green-400 text-white font-bold shadow-lg" onClick={() => {}}>
            + New Meeting
          </Button>
        </div>
        <div className="flex gap-2 items-center mb-4">
          <Button variant="outline" onClick={() => setCurrent(c => ({ ...c, month: c.month - 1 < 0 ? 11 : c.month - 1, year: c.month - 1 < 0 ? c.year - 1 : c.year }))}>&lt;</Button>
          <div className="font-semibold text-lg">{new Date(current.year, current.month).toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
          <Button variant="outline" onClick={() => setCurrent(c => ({ ...c, month: c.month + 1 > 11 ? 0 : c.month + 1, year: c.month + 1 > 11 ? c.year + 1 : c.year }))}>&gt;</Button>
        </div>
        <div className="bg-card rounded-2xl shadow-xl p-6">
          <div className="grid grid-cols-7 gap-2 mb-2 text-center font-semibold">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array(firstDayOfWeek).fill(null).map((_, i) => <div key={i}></div>)}
            {days.map(day => {
              const isToday = day.toDateString() === today.toDateString();
              const { meetings: dayMeetings, tasks: dayTasks } = getEventsForDay(day);
              return (
                <div
                  key={day.toDateString()}
                  className={`rounded-xl p-3 min-h-[60px] border-2 flex flex-col items-center justify-start cursor-pointer transition-all duration-150 ${isToday ? 'bg-gradient-to-r from-blue-400 to-green-300 border-blue-500 text-white font-bold shadow-lg scale-105' : 'bg-muted dark:bg-card border-gray-200 dark:border-gray-700'}`}
                  onClick={() => setSelectedDate(day)}
                >
                  <div>{day.getDate()}</div>
                  <div className="flex gap-1 mt-1">
                    {dayMeetings.length > 0 && <span className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-400 to-green-400 shadow-md" title="Meeting"></span>}
                    {dayTasks.length > 0 && <span className="w-2 h-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 shadow-md" title="Task Deadline"></span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Real-time list of meetings and deadlines for selected day */}
        {selectedDate && (
          <div className="w-full max-w-2xl mx-auto mt-8 bg-card rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold mb-4">Events for {selectedDate.toLocaleDateString()}</h2>
            {loading ? <div className="text-center">Loading...</div> : (
              <>
                {getEventsForDay(selectedDate).meetings.length === 0 && getEventsForDay(selectedDate).tasks.length === 0 && (
                  <div className="text-muted-foreground text-center">No meetings or task deadlines for this day.</div>
                )}
                {getEventsForDay(selectedDate).meetings.map((m: unknown) => (
                  <div key={(m as any).id} className="mb-2 p-3 rounded-xl bg-gradient-to-r from-blue-500 to-green-400 text-white shadow-lg flex flex-col">
                    <div className="font-semibold">📅 {(m as any).title}</div>
                    <div className="text-sm">{new Date((m as any).start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date((m as any).end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    {(m as any).location && <div className="text-xs">Location: {(m as any).location}</div>}
                    {(m as any).meeting_link && <a href={(m as any).meeting_link} className="text-xs underline" target="_blank" rel="noopener noreferrer">Join</a>}
                  </div>
                ))}
                {getEventsForDay(selectedDate).tasks.map((t: unknown) => (
                  <div key={(t as any).id} className={`mb-2 p-3 rounded-xl shadow-lg flex flex-col ${(t as any).priority ? (priorities as Record<string, string>)[(t as any).priority] : 'bg-gray-200 text-black'}`}>
                    <div className="font-semibold">📝 {(t as any).title}</div>
                    <div className="text-sm">Deadline: {(t as any).due_date ? new Date((t as any).due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                    {(t as any).project_id && <div className="text-xs">Project: {(t as any).project_id}</div>}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}