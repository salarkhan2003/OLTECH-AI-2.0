"use client";

import ProtectedLayout from "../(auth)/protected-layout";
import SidebarLayout from "../SidebarLayout";
import { useUser } from "@/context/UserContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

const COLORS = ["#22d3ee", "#fbbf24", "#34d399", "#f87171", "#a78bfa", "#f472b6"];

export default function AnalyticsPage() {
  const { profile } = useUser();
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile?.group_id) return;
    setLoading(true);
    Promise.all([
      supabase.from("tasks").select().eq("group_id", profile.group_id),
      supabase.from("projects").select().eq("group_id", profile.group_id),
      supabase.from("profiles").select().eq("group_id", profile.group_id),
    ]).then(([tasksRes, projectsRes, membersRes]) => {
      if (tasksRes.error) setError(tasksRes.error.message);
      else setTasks(tasksRes.data || []);
      if (projectsRes.error) setError(projectsRes.error.message);
      else setProjects(projectsRes.data || []);
      if (membersRes.error) setError(membersRes.error.message);
      else setMembers(membersRes.data || []);
      setLoading(false);
    });
    // --- Real-time subscriptions for analytics (tasks, projects, profiles) ---
    const taskChannel = supabase.channel('analytics-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `group_id=eq.${profile.group_id}` }, () => {
        supabase.from("tasks").select().eq("group_id", profile.group_id).then(({ data }) => setTasks(data || []));
      })
      .subscribe();
    const projectChannel = supabase.channel('analytics-projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `group_id=eq.${profile.group_id}` }, () => {
        supabase.from("projects").select().eq("group_id", profile.group_id).then(({ data }) => setProjects(data || []));
      })
      .subscribe();
    const memberChannel = supabase.channel('analytics-members')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `group_id=eq.${profile.group_id}` }, () => {
        supabase.from("profiles").select().eq("group_id", profile.group_id).then(({ data }) => setMembers(data || []));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(taskChannel);
      supabase.removeChannel(projectChannel);
      supabase.removeChannel(memberChannel);
    };
  }, [profile?.group_id]);

  // Summary stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Task status pie
  const statusPie = [
    { name: 'To Do', value: tasks.filter(t => t.status === 'todo').length },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length },
    { name: 'Done', value: completedTasks },
  ];

  // Team workload bar
  const workloadBar = members.map(m => ({
    name: m.name,
    Tasks: tasks.filter(t => t.assigned_to === m.id).length,
  }));

  // 30-day completion trend
  const today = new Date();
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

  return (
    <ProtectedLayout>
      <SidebarLayout>
        <main className="p-8 min-h-screen bg-background text-foreground">
          <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
          {loading ? (
            <div>Loading analytics...</div>
          ) : error ? (
            <div className="text-red-600">{error}</div>
          ) : (
            <div className="flex flex-col gap-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-4">
                <div className="bg-card rounded shadow p-4 flex flex-col items-center text-card-foreground">
                  <div className="text-lg font-semibold">Total Tasks</div>
                  <div className="text-2xl font-bold text-blue-600">{totalTasks}</div>
                </div>
                <div className="bg-card rounded shadow p-4 flex flex-col items-center text-card-foreground">
                  <div className="text-lg font-semibold">Completed</div>
                  <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
                </div>
                <div className="bg-card rounded shadow p-4 flex flex-col items-center text-card-foreground">
                  <div className="text-lg font-semibold">Active Projects</div>
                  <div className="text-2xl font-bold text-purple-600">{activeProjects}</div>
                </div>
                <div className="bg-card rounded shadow p-4 flex flex-col items-center text-card-foreground">
                  <div className="text-lg font-semibold">Completion Rate</div>
                  <div className="text-2xl font-bold text-green-700">{completionRate}%</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-card rounded shadow p-4">
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
                <div className="bg-card rounded shadow p-4">
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
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-card rounded shadow p-4">
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
                <div className="bg-card rounded shadow p-4">
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
            </div>
          )}
        </main>
      </SidebarLayout>
    </ProtectedLayout>
  );
} 