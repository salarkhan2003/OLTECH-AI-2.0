"use client";

import ProtectedLayout from "../../(auth)/protected-layout";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";

export default function ProjectDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;
  const [project, setProject] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { profile } = useUser();
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<unknown>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    supabase
      .from("projects")
      .select()
      .eq("id", projectId)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setProject(data);
        setLoading(false);
      });
  }, [projectId]);

  if (loading) return <ProtectedLayout><div className="p-8">Loading...</div></ProtectedLayout>;
  if (error || !project) return <ProtectedLayout><div className="p-8 text-red-600">{error || "Project not found"}</div></ProtectedLayout>;

  // Edit logic
  const startEdit = () => {
    setEditData({ ...project });
    setEditMode(true);
  };
  const saveEdit = async () => {
    setActionLoading(true);
    setActionError("");
    try {
      const { error } = await supabase.from("projects").update({
        name: (editData as any).name,
        description: (editData as any).description,
        due_date: (editData as any).due_date,
        priority: (editData as any).priority,
        assigned_members: (editData as any).assigned_members,
      }).eq("id", projectId);
      if (error) throw error;
      setEditMode(false);
      setProject({ ...project, ...editData });
    } catch (err: unknown) {
      setActionError((err as Error).message || "Failed to update project");
    } finally {
      setActionLoading(false);
    }
  };
  // Delete logic
  const deleteProject = async () => {
    setActionLoading(true);
    setActionError("");
    try {
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
      router.push("/projects");
    } catch (err: unknown) {
      setActionError((err as Error).message || "Failed to delete project");
    } finally {
      setActionLoading(false);
      setDeleteConfirm(false);
    }
  };

  return (
    <ProtectedLayout>
      <div className="p-8 max-w-2xl mx-auto">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">Back</Button>
        {editMode ? (
          <div className="bg-white rounded shadow p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold mb-2">Edit Project</h2>
            <input className="border rounded p-2" value={(editData as any).name} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} title="Project Name" placeholder="Project Name" />
            <textarea className="border rounded p-2" value={(editData as any).description} onChange={e => setEditData(d => ({ ...d, description: e.target.value }))} title="Description" placeholder="Description" />
            <input className="border rounded p-2" type="date" value={(editData as any).due_date || ""} onChange={e => setEditData(d => ({ ...d, due_date: e.target.value }))} title="Deadline" placeholder="Deadline" />
            <select className="border rounded p-2" value={(editData as any).priority || "medium"} onChange={e => setEditData(d => ({ ...d, priority: e.target.value }))} title="Priority Level">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
            {/* Assigned members editing can be added here if needed */}
            {actionError && <div className="text-red-600 text-sm">{actionError}</div>}
            <div className="flex gap-2 mt-2">
              <Button onClick={saveEdit} disabled={actionLoading}>{actionLoading ? "Saving..." : "Save"}</Button>
              <Button variant="outline" onClick={() => setEditMode(false)} disabled={actionLoading}>Cancel</Button>
            </div>
          </div>
        ) : project ? (
          <div className="bg-white rounded shadow p-6 flex flex-col gap-4">
            <h2 className="text-2xl font-bold mb-2">{(project as any).name}</h2>
            <div className="text-gray-600">{(project as any).description}</div>
            <div className="text-sm">Priority: {(project as any).priority}</div>
            <div className="text-sm">Due: {(project as any).due_date}</div>
            <div className="flex gap-2 mt-4">
              {(profile?.id === (project as any).created_by || profile?.role === "admin") && (
                <>
                  <Button onClick={startEdit}>Edit</Button>
                  <Button variant="destructive" onClick={() => setDeleteConfirm(true)}>Delete</Button>
                </>
              )}
            </div>
            {actionError && <div className="text-red-600 text-sm">{actionError}</div>}
          </div>
        ) : (
          <div>Loading...</div>
        )}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow flex flex-col gap-4 items-center">
              <div className="text-lg font-bold">Delete this project?</div>
              <div className="text-sm text-gray-600">This action cannot be undone.</div>
              <div className="flex gap-2 mt-2">
                <Button variant="destructive" onClick={deleteProject} disabled={actionLoading}>{actionLoading ? "Deleting..." : "Delete"}</Button>
                <Button variant="outline" onClick={() => setDeleteConfirm(false)} disabled={actionLoading}>Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
} 