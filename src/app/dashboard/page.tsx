"use client";

import ProtectedLayout from "../(auth)/protected-layout";
import SidebarLayout from "../SidebarLayout";
import { useState, useEffect } from "react";
import { geminiChat } from "@/lib/gemini";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabase";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { Users, FolderKanban, CheckCircle2, BarChart3, CalendarDays, FileText } from "lucide-react";

const COLORS = ["#22d3ee", "#fbbf24", "#34d399", "#f87171", "#a78bfa", "#f472b6"];

export default function DashboardPage() {
  const { profile } = useUser();
  const [aiTip, setAiTip] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch and subscribe to data
  useEffect(() => {
    if (!profile?.group_id) return;
    setLoading(true);
    Promise.all([
      supabase.from("tasks").select().eq("group_id", profile.group_id),
      supabase.from("projects").select().eq("group_id", profile.group_id),
      supabase.from("profiles").select().eq("group_id", profile.group_id),
      supabase.from("activity_log").select().eq("group_id", profile.group_id).order("created_at", { ascending: false }).limit(20),
      supabase.from("meetings").select().eq("group_id", profile.group_id),
      supabase.from("documents").select().eq("group_id", profile.group_id),
    ]).then(([tasksRes, projectsRes, membersRes, activityRes, meetingsRes, documentsRes]) => {
      if (tasksRes.error) setError(tasksRes.error.message);
      else setTasks(tasksRes.data || []);
      if (projectsRes.error) setError(projectsRes.error.message);
      else setProjects(projectsRes.data || []);
      if (membersRes.error) setError(membersRes.error.message);
      else setMembers(membersRes.data || []);
      if (activityRes.error) setError(activityRes.error.message);
      else setActivity(activityRes.data || []);
      if (meetingsRes.error) setError(meetingsRes.error.message);
      else setMeetings(meetingsRes.data || []);
      if (documentsRes.error) setError(documentsRes.error.message);
      else setDocuments(documentsRes.data || []);
      setLoading(false);
    });
    // Real-time subscriptions (tasks, projects, activity, members, meetings, documents)
    const taskChannel = supabase.channel('tasks').on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `group_id=eq.${profile.group_id}` }, () => {
      supabase.from("tasks").select().eq("group_id", profile.group_id).then(({ data }) => setTasks(data || []));
    }).subscribe();
    const projectChannel = supabase.channel('projects').on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `group_id=eq.${profile.group_id}` }, () => {
      supabase.from("projects").select().eq("group_id", profile.group_id).then(({ data }) => setProjects(data || []));
    }).subscribe();
    const activityChannel = supabase.channel('activity_log').on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log', filter: `group_id=eq.${profile.group_id}` }, () => {
      supabase.from("activity_log").select().eq("group_id", profile.group_id).order("created_at", { ascending: false }).limit(20).then(({ data }) => setActivity(data || []));
    }).subscribe();
    const memberChannel = supabase.channel('profiles').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `group_id=eq.${profile.group_id}` }, () => {
      supabase.from("profiles").select().eq("group_id", profile.group_id).then(({ data }) => setMembers(data || []));
    }).subscribe();
    const meetingChannel = supabase.channel('meetings').on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `group_id=eq.${profile.group_id}` }, () => {
      supabase.from("meetings").select().eq("group_id", profile.group_id).then(({ data }) => setMeetings(data || []));
    }).subscribe();
    const documentChannel = supabase.channel('documents').on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `group_id=eq.${profile.group_id}` }, () => {
      supabase.from("documents").select().eq("group_id", profile.group_id).then(({ data }) => setDocuments(data || []));
    }).subscribe();
    return () => {
      supabase.removeChannel(taskChannel);
      supabase.removeChannel(projectChannel);
      supabase.removeChannel(activityChannel);
      supabase.removeChannel(memberChannel);
      supabase.removeChannel(meetingChannel);
      supabase.removeChannel(documentChannel);
    };
  }, [profile?.group_id]);

  // Stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const totalMembers = members.length;
  const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const productivity = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Meetings and Documents stats
  const today = new Date();
  const totalMeetings = meetings.length;
  const upcomingMeetings = meetings.filter(m => m.start_time && new Date(m.start_time) >= today).slice(0, 5);
  const totalDocuments = documents.length;
  const recentDocuments = documents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  // Pie chart: Task status
  const statusPie = [
    { name: 'To Do', value: tasks.filter(t => t.status === 'todo').length },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length },
    { name: 'Done', value: completedTasks },
  ];

  // Bar chart: Tasks per member
  const workloadBar = members.map(m => ({
    name: m.name,
    Tasks: tasks.filter(t => t.assigned_to === m.id).length,
  }));

  // Line chart: 30-day completion trend
  const trend = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (29 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      date: key,
      Completed: tasks.filter(t => t.status === 'done' && t.updated_at && t.updated_at.slice(0, 10) === key).length,
    };
  });

  // Project progress
  const projectProgress = projects.map(p => {
    const projTasks = tasks.filter(t => t.project_id === p.id);
    const done = projTasks.filter(t => t.status === 'done').length;
    return {
      name: p.name,
      Progress: projTasks.length ? Math.round((done / projTasks.length) * 100) : 0,
    };
  });

  // Upcoming deadlines (next 7 days)
  const upcoming = tasks.filter(t => t.due_date && new Date(t.due_date) >= today && new Date(t.due_date) <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000));

  // My open tasks
  const myOpenTasks = tasks.filter(t => t.assigned_to === profile?.id && t.status !== 'done');

  // AI tip
  const getTip = async () => {
    setAiLoading(true);
    setAiError("");
    try {
      const tip = await geminiChat([
        { role: "user", parts: [{ text: "Give me a productivity tip for my workspace dashboard." }] }
      ]);
      setAiTip(tip);
    } catch (err: any) {
      setAiError(err.message || "AI error");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <ProtectedLayout>
      <SidebarLayout>
        <main className="p-8 min-h-screen bg-background text-foreground">
          <div className="mb-6 bg-card rounded shadow p-4 flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <div className="font-bold text-lg">Gemini AI Suggestion</div>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={getTip} disabled={aiLoading}>{aiLoading ? "Thinking..." : "Get Tip"}</Button>
            </div>
            {aiTip && <div className="text-gray-700 text-sm mt-2">{aiTip}</div>}
            {aiError && <div className="text-red-600 text-xs">{aiError}</div>}
          </div>
          <h1 className="text-4xl font-extrabold mb-8 bg-gradient-to-r from-blue-500 via-green-400 to-purple-500 text-transparent bg-clip-text drop-shadow-lg">Dashboard</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6 mb-8">
            {/* Cards: all have min-w-0, w-full, and touch-friendly p-4 on mobile, p-6 on md+ */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-400 dark:from-blue-800 dark:to-blue-600 rounded-2xl shadow-2xl p-4 md:p-6 flex flex-col items-center text-white min-w-0 w-full mb-2 md:mb-0 touch-manipulation">
              <FolderKanban className="w-8 h-8 md:w-10 md:h-10 mb-2 drop-shadow-xl" aria-label="Active Projects Icon" />
              <div className="text-base md:text-lg font-bold">Active Projects</div>
              <div className="text-2xl md:text-3xl font-extrabold mt-1">{activeProjects}</div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-300 dark:from-green-700 dark:to-green-500 rounded-2xl shadow-2xl p-4 md:p-6 flex flex-col items-center text-white min-w-0 w-full mb-2 md:mb-0 touch-manipulation">
              <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10 mb-2 drop-shadow-xl" aria-label="Tasks Completed Icon" />
              <div className="text-base md:text-lg font-bold">Tasks Completed</div>
              <div className="text-2xl md:text-3xl font-extrabold mt-1">{completedTasks}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-600 to-purple-400 dark:from-purple-800 dark:to-purple-600 rounded-2xl shadow-2xl p-4 md:p-6 flex flex-col items-center text-white min-w-0 w-full mb-2 md:mb-0 touch-manipulation">
              <Users className="w-8 h-8 md:w-10 md:h-10 mb-2 drop-shadow-xl" aria-label="Team Members Icon" />
              <div className="text-base md:text-lg font-bold">Team Members</div>
              <div className="text-2xl md:text-3xl font-extrabold mt-1">{totalMembers}</div>
            </div>
            <div className="bg-gradient-to-br from-pink-500 to-pink-300 dark:from-pink-700 dark:to-pink-500 rounded-2xl shadow-2xl p-4 md:p-6 flex flex-col items-center text-white min-w-0 w-full mb-2 md:mb-0 touch-manipulation">
              <BarChart3 className="w-8 h-8 md:w-10 md:h-10 mb-2 drop-shadow-xl" aria-label="Productivity Icon" />
              <div className="text-base md:text-lg font-bold">Productivity</div>
              <div className="text-2xl md:text-3xl font-extrabold mt-1">{productivity}%</div>
            </div>
            <div className="bg-gradient-to-br from-cyan-500 to-cyan-300 dark:from-cyan-700 dark:to-cyan-500 rounded-2xl shadow-2xl p-4 md:p-6 flex flex-col items-center text-white min-w-0 w-full mb-2 md:mb-0 touch-manipulation">
              <CalendarDays className="w-8 h-8 md:w-10 md:h-10 mb-2 drop-shadow-xl" aria-label="Upcoming Meetings Icon" />
              <div className="text-base md:text-lg font-bold">Upcoming Meetings</div>
              <div className="text-2xl md:text-3xl font-extrabold mt-1">{upcomingMeetings.length}</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-400 to-yellow-200 dark:from-yellow-600 dark:to-yellow-400 rounded-2xl shadow-2xl p-4 md:p-6 flex flex-col items-center text-gray-900 dark:text-white min-w-0 w-full mb-2 md:mb-0 touch-manipulation">
              <FileText className="w-8 h-8 md:w-10 md:h-10 mb-2 drop-shadow-xl" aria-label="Documents Icon" />
              <div className="text-base md:text-lg font-bold">Documents</div>
              <div className="text-2xl md:text-3xl font-extrabold mt-1">{totalDocuments}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-card rounded shadow p-4 text-card-foreground">
              <div className="font-semibold mb-2">Task Status Distribution</div>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {statusPie.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card rounded shadow p-4 text-card-foreground">
              <div className="font-semibold mb-2">Team Workload</div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={workloadBar} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="Tasks" fill="#60a5fa" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card rounded shadow p-4 text-card-foreground">
              <div className="font-semibold mb-2">30-Day Completion Trend</div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tickFormatter={d => d.slice(5)} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Completed" stroke="#34d399" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card rounded shadow p-4 text-card-foreground">
              <div className="font-semibold mb-2">Project Progress</div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={projectProgress} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip />
                  <Bar dataKey="Progress" fill="#818cf8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4 md:gap-6 mb-8">
            <section className="bg-card rounded shadow p-4 md:p-6 text-card-foreground">
              <h2 className="text-xl font-semibold mb-2">My Open Tasks</h2>
              {myOpenTasks.length === 0 ? (
                <div className="text-gray-500">No open tasks yet.</div>
              ) : (
                <ul className="list-disc pl-5">
                  {myOpenTasks.map(t => (
                    <li key={t.id} className="mb-1">{t.title} <span className="text-xs text-gray-400">({t.status})</span></li>
                  ))}
                </ul>
              )}
            </section>
            <section className="bg-card rounded shadow p-4 md:p-6 text-card-foreground">
              <h2 className="text-xl font-semibold mb-2">Recent Activity</h2>
              {activity.length === 0 ? (
                <div className="text-gray-500">No activity yet.</div>
              ) : (
                <ul className="list-disc pl-5">
                  {activity.map(a => (
                    <li key={a.id} className="mb-1">{a.description} <span className="text-xs text-gray-400">{(a.created_at ? new Date(a.created_at).toLocaleString() : '')}</span></li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4 md:gap-6">
            <section className="bg-card rounded shadow p-4 md:p-6 text-card-foreground">
              <h2 className="text-xl font-semibold mb-2">Upcoming Deadlines</h2>
              {upcoming.length === 0 ? (
                <div className="text-gray-500">You're all caught up! No deadlines in the next 7 days.</div>
              ) : (
                <ul className="list-disc pl-5">
                  {upcoming.map(t => (
                    <li key={t.id} className="mb-1">{t.title} <span className="text-xs text-gray-400">Due {t.due_date}</span></li>
                  ))}
                </ul>
              )}
            </section>
            <section className="bg-card rounded shadow p-4 md:p-6 text-card-foreground">
              <h2 className="text-xl font-semibold mb-2">Quick Stats</h2>
              <div>Total Tasks: <b>{totalTasks}</b></div>
              <div>Completed: <b>{completedTasks}</b></div>
              <div>In Progress: <b>{tasks.filter(t => t.status === 'in_progress').length}</b></div>
              <div>To Do: <b>{tasks.filter(t => t.status === 'todo').length}</b></div>
              <div>Team Efficiency: <b>{productivity}%</b></div>
            </section>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4 md:gap-6 mb-8">
            <section className="bg-card rounded shadow p-4 md:p-6 text-card-foreground">
              <h2 className="text-xl font-semibold mb-2">Upcoming Meetings</h2>
              {upcomingMeetings.length === 0 ? (
                <div className="text-gray-500">No upcoming meetings.</div>
              ) : (
                <ul className="list-disc pl-5">
                  {upcomingMeetings.map(m => (
                    <li key={m.id} className="mb-1">
                      {m.title} <span className="text-xs text-gray-400">{(m.start_time ? `Starts ${new Date(m.start_time).toLocaleString()}` : '')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="bg-card rounded shadow p-4 md:p-6 text-card-foreground">
              <h2 className="text-xl font-semibold mb-2">Recent Documents</h2>
              {recentDocuments.length === 0 ? (
                <div className="text-gray-500">No documents uploaded yet.</div>
              ) : (
                <ul className="list-disc pl-5">
                  {recentDocuments.map(d => (
                    <li key={d.id} className="mb-1">
                      {d.name} <span className="text-xs text-gray-400">{(d.created_at ? `Uploaded ${new Date(d.created_at).toLocaleString()}` : '')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </main>
      </SidebarLayout>
    </ProtectedLayout>
  );
} 