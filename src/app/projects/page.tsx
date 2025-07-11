"use client";

import ProtectedLayout from "../(auth)/protected-layout";
import SidebarLayout from "../SidebarLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/context/UserContext";
import Link from 'next/link';
import { useRef } from "react";
import { MoreVertical, FolderKanban, PlusCircle, Users, CheckCircle2 } from "lucide-react";
import { BackButton } from "@/components/ui/button";

export default function ProjectsPage() {
  const { profile } = useUser();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "", due_date: "" });
  const [creating, setCreating] = useState(false);
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [assignedMembers, setAssignedMembers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteProject, setDeleteProject] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsProject, setDetailsProject] = useState<any>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Fetch team members
  useEffect(() => {
    if (!profile?.group_id) return;
    supabase.from("profiles").select("id, name, role").eq("group_id", profile.group_id).then(({ data }) => setMembers(data || []));
  }, [profile?.group_id]);

  // Fetch projects for the user's group
  useEffect(() => {
    if (!profile?.group_id) return;
    setLoading(true);
    supabase
      .from("projects")
      .select()
      .eq("group_id", profile.group_id)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setProjects(data || []);
        setLoading(false);
      });
    // --- Real-time subscription for projects ---
    const projectChannel = supabase.channel('projects-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `group_id=eq.${profile.group_id}` }, () => {
        supabase.from("projects").select().eq("group_id", profile.group_id).then(({ data }) => setProjects(data || []));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(projectChannel);
    };
  }, [profile?.group_id, showCreate]);

  useEffect(() => {
    if (!menuOpenId) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      setError("User profile not loaded. Please wait and try again.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const { error } = await supabase.from("projects").insert({
        name: newProject.name,
        description: newProject.description,
        due_date: deadline || null,
        group_id: profile.group_id,
        status: "active",
        created_by: profile.id,
        priority,
        assigned_members: assignedMembers,
      });
      if (error) throw error;
      setShowCreate(false);
      setNewProject({ name: "", description: "", due_date: "" });
      setPriority("medium");
      setDeadline("");
      setAssignedMembers([]);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Failed to create project");
      } else {
        setError("Failed to create project");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <ProtectedLayout>
      <SidebarLayout>
        <main className="p-4 sm:p-6 md:p-8 min-h-screen bg-background text-foreground">
          <div className="flex items-center gap-4 mb-4">
            <BackButton />
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 via-green-500 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">Projects</h1>
            <Button className="bg-gradient-to-r from-blue-600 via-green-500 to-yellow-400 text-white font-bold shadow-lg min-h-[44px] min-w-[44px] flex items-center gap-2" onClick={() => setShowCreate(true)} aria-label="New Project">
              <PlusCircle className="w-5 h-5" /> New Project
            </Button>
          </div>
          <div className="flex gap-4 mb-4 items-center">
            <Input placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
            <select className="border rounded p-2" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} title="Filter by Status">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          {loading ? (
            <div>Loading projects...</div>
          ) : error ? (
            <div className="text-red-600">{error}</div>
          ) : (
            <>
              {projects.filter(p => (!search || p.name.toLowerCase().includes(search.toLowerCase())) && (!statusFilter || p.status === statusFilter)).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <div className="text-2xl font-bold mb-2">No projects found</div>
                  <div className="mb-4">Create your first project to get started</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  {projects.filter(p => (!search || p.name.toLowerCase().includes(search.toLowerCase())) && (!statusFilter || p.status === statusFilter)).map((project) => (
                    <div key={project.id} className="bg-gradient-to-br from-blue-100 via-green-50 to-yellow-50 dark:from-blue-900 dark:via-green-900 dark:to-yellow-900 rounded-2xl shadow-2xl p-4 md:p-6 flex flex-col gap-2 hover:ring-2 hover:ring-blue-400 transition cursor-pointer relative text-card-foreground min-w-0 w-full touch-manipulation">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-extrabold flex items-center gap-2 bg-gradient-to-r from-blue-600 via-green-500 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
                          <FolderKanban className="w-7 h-7" aria-label="Project" />
                          {project.name}
                        </h2>
                        <div ref={menuRef} className="relative">
                          <button
                            className="p-1 rounded hover:bg-blue-100"
                            onClick={e => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === project.id ? null : project.id);
                            }}
                            title="More options"
                            aria-label="Project actions"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          {menuOpenId === project.id && (
                            <div className="absolute top-10 right-2 bg-card border rounded shadow-lg z-10 flex flex-col min-w-[120px] text-card-foreground animate-fade-in">
                              <button className="px-4 py-2 hover:bg-blue-50 text-left" onClick={e => { e.stopPropagation(); setEditProject(project); setShowEdit(true); setMenuOpenId(null); }}>Edit</button>
                              <button className="px-4 py-2 hover:bg-red-50 text-left text-red-600" onClick={e => { e.stopPropagation(); setDeleteProject(project); setShowDelete(true); setMenuOpenId(null); }}>Delete</button>
                              <button className="px-4 py-2 hover:bg-blue-50 text-left" onClick={e => { e.stopPropagation(); setDetailsProject(project); setShowDetails(true); setMenuOpenId(null); }}>View Details</button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-gray-600">Due: {project.due_date}</div>
                      <div className="flex gap-4 text-sm mt-2">
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-500" aria-label="Priority" /> {project.priority ? project.priority.charAt(0).toUpperCase() + project.priority.slice(1) : 'Medium'}</span>
                        <span className="flex items-center gap-1"><Users className="w-4 h-4 text-blue-500" aria-label="Members" /> {project.assigned_members ? project.assigned_members.length : 0} members</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {showCreate && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-card p-6 rounded shadow w-full max-w-md flex flex-col gap-4 text-card-foreground">
                <h2 className="text-xl font-bold mb-2">Create New Project</h2>
                <form className="flex flex-col gap-3" onSubmit={handleCreate}>
                  <Input placeholder="Project Name" value={newProject.name || ""} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))} required />
                  <Input placeholder="Description" value={newProject.description || ""} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} />
                  <label htmlFor="priority-select" className="text-sm font-medium">Priority Level</label>
                  <select id="priority-select" title="Priority" className="border rounded p-2" value={priority || ""} onChange={e => setPriority(e.target.value)} required>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                  <label htmlFor="deadline-input" className="text-sm font-medium">Deadline (Optional)</label>
                  <Input id="deadline-input" type="date" value={deadline || ""} onChange={e => setDeadline(e.target.value)} />
                  <label className="text-sm font-medium">Assign Team Members</label>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border rounded p-2">
                    {members.map(m => (
                      <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={assignedMembers.includes(m.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setAssignedMembers(prev => [...prev, m.id]);
                            } else {
                              setAssignedMembers(prev => prev.filter(id => id !== m.id));
                            }
                          }}
                        />
                        <span>{m.name} {m.role ? `(${m.role.charAt(0).toUpperCase() + m.role.slice(1)})` : ''}</span>
                      </label>
                    ))}
                  </div>
                  {error && <div className="text-red-600 text-sm">{error}</div>}
                  <div className="flex gap-2 mt-2">
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={creating}>{creating ? "Creating..." : "Create Project"}</Button>
                    <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {/* Edit Project Modal */}
          {showEdit && editProject && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-card p-6 rounded shadow w-full max-w-md flex flex-col gap-4 text-card-foreground">
                <h2 className="text-xl font-bold mb-2">Edit Project</h2>
                <form className="flex flex-col gap-3" onSubmit={async e => {
                  e.preventDefault();
                  setCreating(true);
                  setError("");
                  try {
                    const { error } = await supabase.from("projects").update({
                      name: editProject.name,
                      description: editProject.description,
                      due_date: editProject.due_date || null,
                      priority: editProject.priority,
                      assigned_members: editProject.assigned_members,
                    }).eq("id", editProject.id);
                    if (error) throw error;
                    setShowEdit(false);
                    setEditProject(null);
                    // Refresh projects
                    setLoading(true);
                    const { data, error: fetchError } = await supabase.from("projects").select().eq("group_id", profile.group_id);
                    if (!fetchError) setProjects(data || []);
                    setLoading(false);
                  } catch (err: unknown) {
                    if (err instanceof Error) {
                      setError(err.message || "Failed to update project");
                    } else {
                      setError("Failed to update project");
                    }
                  } finally {
                    setCreating(false);
                  }
                }}>
                  <Input placeholder="Project Name" value={editProject.name || ""} onChange={e => setEditProject((p: any) => ({ ...p, name: e.target.value }))} required />
                  <Input placeholder="Description" value={editProject.description || ""} onChange={e => setEditProject((p: any) => ({ ...p, description: e.target.value }))} />
                  <label className="text-sm font-medium">Priority Level</label>
                  <select className="border rounded p-2" value={editProject.priority || ""} onChange={e => setEditProject((p: any) => ({ ...p, priority: e.target.value }))} required title="Priority Level">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                  <label className="text-sm font-medium">Deadline (Optional)</label>
                  <Input type="date" value={editProject.due_date || ""} onChange={e => setEditProject((p: any) => ({ ...p, due_date: e.target.value }))} />
                  <label className="text-sm font-medium">Assign Team Members</label>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border rounded p-2">
                    {members.map(m => (
                      <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editProject.assigned_members?.includes(m.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setEditProject((p: any) => ({ ...p, assigned_members: [...(p.assigned_members || []), m.id] }));
                            } else {
                              setEditProject((p: any) => ({ ...p, assigned_members: (p.assigned_members || []).filter((id: string) => id !== m.id) }));
                            }
                          }}
                        />
                        <span>{m.name} {m.role ? `(${m.role.charAt(0).toUpperCase() + m.role.slice(1)})` : ''}</span>
                      </label>
                    ))}
                  </div>
                  {error && <div className="text-red-600 text-sm">{error}</div>}
                  <div className="flex gap-2 mt-2">
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={creating}>{creating ? "Saving..." : "Save"}</Button>
                    <Button variant="outline" type="button" onClick={() => { setShowEdit(false); setEditProject(null); }}>Cancel</Button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {/* Delete Project Modal */}
          {showDelete && deleteProject && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-card p-6 rounded shadow w-full max-w-md flex flex-col gap-4 items-center text-card-foreground">
                <h2 className="text-xl font-bold mb-2">Delete Project</h2>
                <div>Are you sure you want to delete <span className="font-semibold">{deleteProject.name}</span>?</div>
                {error && <div className="text-red-600 text-sm">{error}</div>}
                <div className="flex gap-2 mt-2">
                  <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={async () => {
                    setCreating(true);
                    setError("");
                    try {
                      const { error } = await supabase.from("projects").delete().eq("id", deleteProject.id);
                      if (error) throw error;
                      setShowDelete(false);
                      setDeleteProject(null);
                      // Refresh projects
                      setLoading(true);
                      const { data, error: fetchError } = await supabase.from("projects").select().eq("group_id", profile.group_id);
                      if (!fetchError) setProjects(data || []);
                      setLoading(false);
                    } catch (err: unknown) {
                      if (err instanceof Error) {
                        setError(err.message || "Failed to delete project");
                      } else {
                        setError("Failed to delete project");
                      }
                    } finally {
                      setCreating(false);
                    }
                  }} disabled={creating}>{creating ? "Deleting..." : "Delete"}</Button>
                  <Button variant="outline" onClick={() => { setShowDelete(false); setDeleteProject(null); }}>Cancel</Button>
                </div>
              </div>
            </div>
          )}
          {/* View Details Modal */}
          {showDetails && detailsProject && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-card p-6 rounded shadow w-full max-w-md flex flex-col gap-4 text-card-foreground">
                <h2 className="text-xl font-bold mb-2">Project Details</h2>
                <div><span className="font-semibold">Name:</span> {detailsProject.name}</div>
                <div><span className="font-semibold">Description:</span> {detailsProject.description}</div>
                <div><span className="font-semibold">Priority:</span> {detailsProject.priority}</div>
                <div><span className="font-semibold">Deadline:</span> {detailsProject.due_date}</div>
                <div><span className="font-semibold">Members:</span> {members.filter(m => detailsProject.assigned_members?.includes(m.id)).map(m => m.name).join(", ") || 'None'}</div>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" onClick={() => { setShowDetails(false); setDetailsProject(null); }}>Close</Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </SidebarLayout>
    </ProtectedLayout>
  );
} 