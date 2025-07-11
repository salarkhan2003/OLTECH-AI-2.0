"use client";

import ProtectedLayout from "../(auth)/protected-layout";
import SidebarLayout from "../SidebarLayout";
import { useUser } from "@/context/UserContext";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { geminiChat } from "@/lib/gemini";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderKanban, UserCircle2, ChevronDown, MoreVertical, PlusCircle, CheckCircle2, BarChart3 } from "lucide-react";
import { BackButton } from "@/components/ui/button";
import Image from "next/image";

const statusColumns = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

const priorities = [
  { key: "emergency", label: "Emergency" },
  { key: "urgent", label: "Urgent" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

export default function TasksPage() {
  const { profile } = useUser();
  const [tasks, setTasks] = useState<unknown[]>([]);
  const [projects, setProjects] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
    status: "todo",
    project_id: "",
    assigned_to: "",
  });
  const [editTask, setEditTask] = useState<unknown>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<unknown[]>([]);
  const [aiTip, setAiTip] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [createdTaskSummary, setCreatedTaskSummary] = useState<unknown>(null);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  // Filtering state
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterProject, setFilterProject] = useState("");

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t =>
      (!filterAssignee || (t as any).assigned_to === filterAssignee) &&
      (!filterPriority || (t as any).priority === filterPriority) &&
      (!filterProject || (t as any).project_id === filterProject)
    );
  }, [tasks, filterAssignee, filterPriority, filterProject]);

  // Smart due date formatting
  function formatDueDate(dateStr: string) {
    if (!dateStr) return "No due date";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diff < -1) return `Overdue (${date.toLocaleDateString()})`;
    if (diff < 0) return `Due yesterday`;
    if (diff < 1) return `Due today`;
    if (diff < 2) return `Due tomorrow`;
    return date.toLocaleDateString();
  }

  // Priority badge color
  function getPriorityClass(priority: string) {
    switch (priority) {
      case "emergency": return "bg-red-500 text-white";
      case "urgent": return "bg-orange-500 text-white";
      case "high": return "bg-orange-400 text-white";
      case "medium": return "bg-yellow-300 text-black";
      case "low": return "bg-green-300 text-black";
      default: return "bg-gray-300 text-black";
    }
  }

  // Dropdown menu state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Task count per column
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    statusColumns.forEach(col => {
      counts[col.key] = filteredTasks.filter(t => (t as any).status === col.key).length;
    });
    return counts;
  }, [filteredTasks]);

  // Overflow handling (show max 5, then '+X more')
  const MAX_VISIBLE = 5;

  // Fetch tasks, projects, and profiles for the user's group
  useEffect(() => {
    if (!profile?.group_id) return;
    setLoading(true);
    Promise.all([
      supabase.from("tasks").select().eq("group_id", profile.group_id),
      supabase.from("projects").select("id, name").eq("group_id", profile.group_id),
      supabase.from("profiles").select("id, name, avatar_url").eq("group_id", profile.group_id),
    ]).then(([tasksRes, projectsRes, profilesRes]) => {
      if (tasksRes.error) setError(tasksRes.error.message);
      else setTasks(tasksRes.data || []);
      if (projectsRes.error) setError(projectsRes.error.message);
      else setProjects(projectsRes.data || []);
      if (profilesRes.error) setError(profilesRes.error.message);
      else setProfiles(profilesRes.data || []);
      setLoading(false);
    });
    // --- Real-time subscription for tasks ---
    const taskChannel = supabase.channel('tasks-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `group_id=eq.${profile.group_id}` }, () => {
        supabase.from("tasks").select().eq("group_id", profile.group_id).then(({ data }) => setTasks(data || []));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(taskChannel);
    };
  }, [profile?.group_id, showCreate, editTask]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      setError("User profile not loaded. Please wait and try again.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const insertData = {
        ...newTask,
        group_id: profile.group_id,
        created_by: profile.id,
        // Only include fields if they are filled (except title)
        description: newTask.description || null,
        priority: newTask.priority || null,
        due_date: newTask.due_date || null,
        status: newTask.status || null,
        project_id: newTask.project_id || null,
        assigned_to: newTask.assigned_to || null,
      };
      const { data, error } = await supabase.from("tasks").insert(insertData).select().single();
      if (error) throw error;
      setShowCreate(false);
      setCreatedTaskSummary({
        ...data,
        creator: profile.name,
        assignee: profiles.find(p => (p as any).id === newTask.assigned_to)?.name || "Unassigned",
        project: projects.find(p => (p as any).id === newTask.project_id)?.name || "--",
      });
      setShowSummary(true);
      setNewTask({ title: "", description: "", priority: "medium", due_date: "", status: "todo", project_id: "", assigned_to: "" });
    } catch (err: any) {
      setError(err.message || "Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setError("");
    try {
      const updateData = {
        ...editTask,
        description: (editTask as any).description || null,
        priority: (editTask as any).priority || null,
        due_date: (editTask as any).due_date || null,
        status: (editTask as any).status || null,
        project_id: (editTask as any).project_id || null,
        assigned_to: (editTask as any).assigned_to || null,
      };
      const { error } = await supabase.from("tasks").update(updateData).eq("id", (editTask as any).id);
      if (error) throw error;
      setEditTask(null);
    } catch (err: any) {
      setError(err.message || "Failed to update task");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(id);
    setError("");
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "Failed to delete task");
    } finally {
      setDeleteLoading(null);
    }
  };

  const getTip = async () => {
    setAiLoading(true);
    setAiError("");
    try {
      const tip = await geminiChat([
        { role: "user", parts: [{ text: "Give me a tip for managing tasks in a team workspace." }] }
      ]);
      setAiTip(tip);
    } catch (err: any) {
      setAiError(err.message || "AI error");
    } finally {
      setAiLoading(false);
    }
  };

  async function handleStatusChange(taskId: string, newStatus: string) {
    setStatusLoading(taskId);
    setError("");
    try {
      const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
      if (error) throw error;
      // Update local state for instant UI feedback
      setTasks(prev => prev.map(t => (t as any).id === taskId ? { ...t, status: newStatus } : t));
    } catch (err: any) {
      setError(err.message || "Failed to update status");
    } finally {
      setStatusLoading(null);
    }
  }

  return (
    <ProtectedLayout>
      <SidebarLayout>
        <main className="p-8 min-h-screen bg-background text-foreground">
          <div className="flex items-center gap-4 mb-4">
            <BackButton />
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 via-green-500 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">Tasks</h1>
          </div>
          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 flex-wrap">
                <select className="border rounded p-2 bg-background text-foreground dark:bg-background dark:text-foreground" value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} title="Filter by assignee">
                  <option value="">All Assignees</option>
                  {profiles.map(p => <option key={(p as any).id} value={(p as any).id}>{(p as any).name}</option>)}
                </select>
                <select className="border rounded p-2 bg-background text-foreground dark:bg-background dark:text-foreground" value={filterPriority} onChange={e => setFilterPriority(e.target.value)} title="Filter by priority">
                  <option value="">All Priorities</option>
                  {priorities.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
                <select className="border rounded p-2 bg-background text-foreground dark:bg-background dark:text-foreground" value={filterProject} onChange={e => setFilterProject(e.target.value)} title="Filter by project">
                  <option value="">All Projects</option>
                  {projects.map(p => <option key={(p as any).id} value={(p as any).id}>{(p as any).name}</option>)}
                </select>
              </div>
            </div>
            <Button className="bg-gradient-to-r from-blue-600 via-green-500 to-yellow-400 text-white font-bold shadow-lg min-h-[44px] min-w-[44px] flex items-center gap-2" onClick={() => setShowCreate(true)} aria-label="Quick Task">
              <PlusCircle className="w-5 h-5" /> Quick Task
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {statusColumns.map((col, idx) => {
              const colTasks = filteredTasks.filter(t => (t as any).status === col.key);
              const colGradient = [
                "from-blue-200 via-blue-100 to-blue-50 dark:from-blue-900 dark:via-blue-800 dark:to-blue-700",
                "from-yellow-100 via-green-100 to-blue-100 dark:from-yellow-900 dark:via-green-900 dark:to-blue-900",
                "from-green-200 via-green-100 to-green-50 dark:from-green-900 dark:via-green-800 dark:to-green-700"
              ][idx];
              return (
                <div key={col.key} className={`bg-gradient-to-br ${colGradient} rounded-2xl shadow-2xl p-4 md:p-6 flex flex-col min-h-[500px] border-2 border-blue-100 dark:border-blue-900 text-card-foreground mb-4 md:mb-0`}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-extrabold flex items-center gap-2 bg-gradient-to-r from-blue-600 via-green-500 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
                      {col.key === 'todo' && <FolderKanban className="w-7 h-7" aria-label="To Do" />}
                      {col.key === 'in_progress' && <BarChart3 className="w-7 h-7" aria-label="In Progress" />}
                      {col.key === 'done' && <CheckCircle2 className="w-7 h-7" aria-label="Done" />}
                      {col.label}
                      <span className="ml-2 bg-blue-200 text-blue-800 rounded-full px-2 py-0.5 text-xs font-bold">{taskCounts[col.key]}</span>
                    </h2>
                  </div>
                  <div className="flex-1 flex flex-col gap-3">
                    {colTasks.length === 0 && <div className="text-gray-400 text-center mt-8">No tasks</div>}
                    {colTasks.slice(0, MAX_VISIBLE).map(task => {
                      const assignee = profiles.find(p => (p as any).id === (task as any).assigned_to);
                      const project = projects.find(p => (p as any).id === (task as any).project_id);
                      return (
                        <div key={(task as any).id} className="bg-white dark:bg-background rounded-xl p-4 shadow-lg flex flex-col gap-2 relative group border border-blue-100 dark:border-blue-900 min-w-0 w-full touch-manipulation">
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-lg truncate" title={(task as any).title}>{(task as any).title}</div>
                            <button className="p-1 rounded hover:bg-blue-100" onClick={() => setOpenDropdown(openDropdown === (task as any).id ? null : (task as any).id)} title="Task actions" aria-label="Task actions">
                              <MoreVertical className="w-5 h-5 text-blue-700" />
                            </button>
                            {openDropdown === (task as any).id && (
                              <div className="absolute right-2 top-10 z-50 bg-card border rounded shadow-lg flex flex-col min-w-[120px] animate-fade-in text-card-foreground">
                                <button className="px-4 py-2 hover:bg-blue-50 text-left" onClick={() => { setEditTask(task); setOpenDropdown(null); }}>Edit</button>
                                <button className="px-4 py-2 hover:bg-red-50 text-left text-red-600" onClick={() => { handleDelete((task as any).id); setOpenDropdown(null); }} disabled={deleteLoading === (task as any).id}>{deleteLoading === (task as any).id ? 'Deleting...' : 'Delete'}</button>
                              </div>
                            )}
                          </div>
                          {(task as any).description && <div className="text-sm text-gray-700 truncate" title={(task as any).description}>{(task as any).description}</div>}
                          <div className="flex gap-2 text-xs mt-1 items-center">
                            <span className={`px-2 py-0.5 rounded font-bold ${getPriorityClass((task as any).priority)}`}>{(task as any).priority?.toUpperCase()}</span>
                            <span className="text-gray-600">{formatDueDate((task as any).due_date)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                            {assignee ? (
                              <>
                                {assignee.avatar_url ? (
                                  <Image src={assignee.avatar_url} alt={assignee.name} width={24} height={24} className="w-6 h-6 rounded-full border-2 border-white shadow" />
                                ) : (
                                  <UserCircle2 className="w-6 h-6 text-blue-500" />
                                )}
                                <span className="font-bold">{assignee.name}</span>
                              </>
                            ) : (
                              <>
                                <UserCircle2 className="w-6 h-6 text-blue-500" />
                                <span>Unassigned</span>
                              </>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">Project: <span className="font-bold">{project?.name || '--'}</span></div>
                          <div className="flex items-center gap-2 mt-2">
                            <label htmlFor={`status-select-${(task as any).id}`} className="text-xs font-bold">Status:</label>
                            <select
                              id={`status-select-${(task as any).id}`}
                              className="border rounded p-1 bg-background text-foreground dark:bg-background dark:text-foreground text-xs"
                              value={(task as any).status}
                              onChange={e => handleStatusChange((task as any).id, e.target.value)}
                              disabled={statusLoading === (task as any).id}
                              title="Change status"
                              aria-label="Change status"
                            >
                              {statusColumns.map(s => (
                                <option key={s.key} value={s.key}>{s.label}</option>
                              ))}
                            </select>
                            {statusLoading === (task as any).id && <span className="ml-2 text-xs text-blue-500 animate-pulse">Saving...</span>}
                          </div>
                        </div>
                      );
                    })}
                    {colTasks.length > MAX_VISIBLE && (
                      <div className="text-center text-blue-600 font-bold cursor-pointer hover:underline" title="Show all tasks">+{colTasks.length - MAX_VISIBLE} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {showCreate && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-card p-6 rounded shadow w-full max-w-md flex flex-col gap-4 text-card-foreground">
                <h2 className="text-xl font-bold mb-2">Create New Task</h2>
                <form className="flex flex-col gap-3" onSubmit={handleCreate}>
                  <Input placeholder="Title" value={newTask.title || ""} onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))} required />
                  <Input placeholder="Description (optional)" value={newTask.description || ""} onChange={e => setNewTask(t => ({ ...t, description: e.target.value }))} />
                  <label htmlFor="priority-select" className="text-sm font-medium">Priority (optional)</label>
                  <select id="priority-select" title="Priority" className="border rounded p-2 bg-background text-foreground dark:bg-background dark:text-foreground" value={newTask.priority || ""} onChange={e => setNewTask(t => ({ ...t, priority: e.target.value }))}>
                    <option value="">No Priority</option>
                    {priorities.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                  <label htmlFor="deadline-input" className="text-sm font-medium">Deadline (optional)</label>
                  <Input id="deadline-input" type="date" value={newTask.due_date || ""} onChange={e => setNewTask(t => ({ ...t, due_date: e.target.value }))} className="bg-background text-foreground dark:bg-background dark:text-foreground" />
                  <label htmlFor="status-select" className="text-sm font-medium">Status (optional)</label>
                  <select id="status-select" title="Status" className="border rounded p-2 bg-background text-foreground dark:bg-background dark:text-foreground" value={newTask.status || ""} onChange={e => setNewTask(t => ({ ...t, status: e.target.value }))}>
                    <option value="">No Status</option>
                    {statusColumns.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <label htmlFor="project-select" className="text-sm font-medium">Project (optional)</label>
                  <select id="project-select" title="Project" className="border rounded p-2 bg-background text-foreground dark:bg-background dark:text-foreground" value={newTask.project_id || ""} onChange={e => setNewTask(t => ({ ...t, project_id: e.target.value }))}>
                    <option value="">No Project</option>
                    {projects.map(p => <option key={(p as any).id} value={(p as any).id}>{(p as any).name}</option>)}
                  </select>
                  <label htmlFor="assignee-select" className="text-sm font-medium">Assignee (optional)</label>
                  <select id="assignee-select" title="Assignee" className="border rounded p-2 bg-background text-foreground dark:bg-background dark:text-foreground" value={newTask.assigned_to || ""} onChange={e => setNewTask(t => ({ ...t, assigned_to: e.target.value }))}>
                    <option value="">Unassigned</option>
                    {profiles.map(p => <option key={(p as any).id} value={(p as any).id}>{(p as any).name}</option>)}
                  </select>
                  {error && <div className="text-red-600 text-sm">{error}</div>}
                  <div className="flex gap-2 mt-2">
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={creating || !profile}>{creating ? "Creating..." : "Create"}</Button>
                    <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {showSummary && createdTaskSummary && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-card p-6 rounded shadow w-full max-w-md flex flex-col gap-4 text-card-foreground">
                <h2 className="text-xl font-bold mb-2">Task Created!</h2>
                <div className="flex flex-col gap-2">
                  <div><span className="font-semibold">Title:</span> {(createdTaskSummary as any).title}</div>
                  {(createdTaskSummary as any).due_date && <div><span className="font-semibold">Deadline:</span> {(createdTaskSummary as any).due_date}</div>}
                  <div><span className="font-semibold">Created By:</span> {(createdTaskSummary as any).creator}</div>
                  <div><span className="font-semibold">Assignee:</span> {(createdTaskSummary as any).assignee}</div>
                  <div><span className="font-semibold">Project:</span> {(createdTaskSummary as any).project}</div>
                  {(createdTaskSummary as any).description && <div><span className="font-semibold">Description:</span> {(createdTaskSummary as any).description}</div>}
                  {(createdTaskSummary as any).priority && <div><span className="font-semibold">Priority:</span> {(createdTaskSummary as any).priority}</div>}
                  {(createdTaskSummary as any).status && <div><span className="font-semibold">Status:</span> {(createdTaskSummary as any).status}</div>}
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white mt-2" onClick={() => setShowSummary(false)}>Close</Button>
              </div>
            </div>
          )}
          {editTask && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-card p-6 rounded shadow w-full max-w-md flex flex-col gap-4 text-card-foreground">
                <h2 className="text-xl font-bold mb-2">Edit Task</h2>
                <form className="flex flex-col gap-3" onSubmit={handleEdit}>
                  <Input placeholder="Title" value={(editTask as any).title || ""} onChange={e => setEditTask((t: any) => ({ ...t, title: e.target.value }))} required />
                  <Input placeholder="Description (optional)" value={(editTask as any).description || ""} onChange={e => setEditTask((t: any) => ({ ...t, description: e.target.value }))} />
                  <label htmlFor="edit-priority-select" className="text-sm font-medium">Priority (optional)</label>
                  <select id="edit-priority-select" title="Priority" className="border rounded p-2 bg-background text-foreground dark:bg-background dark:text-foreground" value={(editTask as any).priority || ""} onChange={e => setEditTask((t: any) => ({ ...t, priority: e.target.value }))}>
                    <option value="">No Priority</option>
                    {priorities.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                  <label htmlFor="edit-deadline-input" className="text-sm font-medium">Deadline (optional)</label>
                  <Input id="edit-deadline-input" type="date" value={(editTask as any).due_date || ""} onChange={e => setEditTask((t: any) => ({ ...t, due_date: e.target.value }))} className="bg-background text-foreground dark:bg-background dark:text-foreground" />
                  <label htmlFor="edit-status-select" className="text-sm font-medium">Status (optional)</label>
                  <select id="edit-status-select" title="Status" className="border rounded p-2 bg-background text-foreground dark:bg-background dark:text-foreground" value={(editTask as any).status || ""} onChange={e => setEditTask((t: any) => ({ ...t, status: e.target.value }))}>
                    <option value="">No Status</option>
                    {statusColumns.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <label htmlFor="edit-project-select" className="text-sm font-medium">Project (optional)</label>
                  <select id="edit-project-select" title="Project" className="border rounded p-2 bg-background text-foreground dark:bg-background dark:text-foreground" value={(editTask as any).project_id || ""} onChange={e => setEditTask((t: any) => ({ ...t, project_id: e.target.value }))}>
                    <option value="">No Project</option>
                    {projects.map(p => <option key={(p as any).id} value={(p as any).id}>{(p as any).name}</option>)}
                  </select>
                  <label htmlFor="edit-assignee-select" className="text-sm font-medium">Assignee (optional)</label>
                  <select id="edit-assignee-select" title="Assignee" className="border rounded p-2 bg-background text-foreground dark:bg-background dark:text-foreground" value={(editTask as any).assigned_to || ""} onChange={e => setEditTask((t: any) => ({ ...t, assigned_to: e.target.value }))}>
                    <option value="">Unassigned</option>
                    {profiles.map(p => <option key={(p as any).id} value={(p as any).id}>{(p as any).name}</option>)}
                  </select>
                  {error && <div className="text-red-600 text-sm">{error}</div>}
                  <div className="flex gap-2 mt-2">
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={editLoading}>{editLoading ? "Saving..." : "Save"}</Button>
                    <Button variant="outline" type="button" onClick={() => setEditTask(null)}>Cancel</Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </SidebarLayout>
    </ProtectedLayout>
  );
} 