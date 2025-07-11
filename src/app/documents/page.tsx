"use client";

import ProtectedLayout from "../(auth)/protected-layout";
import SidebarLayout from "../SidebarLayout";
import { useUser } from "@/context/UserContext";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, MessageCircle, FileText, PlusCircle } from "lucide-react";
import { BackButton } from "@/components/ui/button";

const categories = ["design", "development", "documentation", "media", "other"];

export default function DocumentsPage() {
  const { profile } = useUser();
  const [files, setFiles] = useState<unknown[]>([]);
  const [projects, setProjects] = useState<unknown[]>([]);
  const [tasks, setTasks] = useState<unknown[]>([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileCategory, setFileCategory] = useState(categories[0]);
  const [fileProject, setFileProject] = useState("");
  const [fileTask, setFileTask] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [editingDescId, setEditingDescId] = useState<string | null>(null);
  const [descEdit, setDescEdit] = useState("");
  const [comments, setComments] = useState<Record<string, unknown[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [commentLoading, setCommentLoading] = useState<string | null>(null);
  const [fileDescription, setFileDescription] = useState("");
  const [debugInfo, setDebugInfo] = useState("");
  const [profiles, setProfiles] = useState<unknown[]>([]);

  // Fetch files, projects, tasks, and profiles
  useEffect(() => {
    if (!profile?.group_id) return;
    setError("");
    Promise.all([
      supabase.from("documents").select().eq("group_id", profile.group_id),
      supabase.from("projects").select("id, name").eq("group_id", profile.group_id),
      supabase.from("tasks").select("id, title").eq("group_id", profile.group_id),
      supabase.from("profiles").select("id, name, email, avatar_url").eq("group_id", profile.group_id),
    ]).then(([filesRes, projectsRes, tasksRes, profilesRes]) => {
      if (filesRes.error) setError(filesRes.error.message);
      else setFiles(filesRes.data || []);
      if (projectsRes.error) setError(projectsRes.error.message);
      else setProjects(projectsRes.data || []);
      if (tasksRes.error) setError(tasksRes.error.message);
      else setTasks(tasksRes.data || []);
      if (profilesRes.error) setError(profilesRes.error.message);
      else setProfiles(profilesRes.data || []);
    });
    // --- Real-time subscriptions for documents and comments ---
    const docChannel = supabase.channel('documents-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `group_id=eq.${profile.group_id}` }, () => {
        supabase.from("documents").select().eq("group_id", profile.group_id).then(({ data }) => setFiles(data || []));
      })
      .subscribe();
    const commentChannel = supabase.channel('document-comments-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_comments' }, () => {
        // Re-fetch all comments for current files
        const docIds = files.map(f => (f as any).id);
        if (docIds.length > 0) {
          supabase.from("document_comments").select().in("document_id", docIds).then(({ data, error }) => {
            if (!error && data) {
              const grouped = {};
              data.forEach((c) => {
                if (!grouped[c.document_id]) grouped[c.document_id] = [];
                grouped[c.document_id].push(c);
              });
              setComments(grouped);
            }
          });
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(docChannel);
      supabase.removeChannel(commentChannel);
    };
  }, [profile?.group_id, uploading, files.length]);

  // Fetch comments for all documents
  useEffect(() => {
    if (!profile?.group_id || files.length === 0) return;
    const fetchAllComments = async () => {
      const docIds = files.map(f => (f as any).id);
      const { data, error } = await supabase.from("document_comments").select().in("document_id", docIds);
      if (!error && data) {
        const grouped: Record<string, unknown[]> = {};
        data.forEach((c: any) => {
          if (!grouped[c.document_id]) grouped[c.document_id] = [];
          grouped[c.document_id].push(c);
        });
        setComments(grouped);
      }
    };
    fetchAllComments();
  }, [files, profile?.group_id]);

  // Handle file drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  // --- Robust Upload Handler ---
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      setError("User profile not loaded. Please wait and try again.");
      return;
    }
    if (!file) return;
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `documents/${profile.group_id}/${profile.id}/${timestamp}_${safeName}`;
      // Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
      if (uploadErr) {
        console.error('Supabase Storage upload error:', uploadErr);
        throw new Error(uploadErr.message || 'Failed to upload file to storage.');
      }
      // Insert metadata to documents table
      const { error: docErr } = await supabase.from('documents').insert({
        name: file.name,
        description: fileDescription,
        file_url: path,
        file_size: file.size,
        file_type: file.type,
        category: fileCategory,
        project_id: fileProject || null,
        task_id: fileTask || null,
        group_id: profile.group_id,
        uploaded_by: profile.id,
      });
      if (docErr) {
        console.error('Supabase DB insert error:', docErr);
        throw new Error(docErr.message || 'Failed to save file metadata.');
      }
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setFileCategory(categories[0]);
      setFileProject("");
      setFileTask("");
      setFileDescription("");
      setSuccess("File uploaded successfully!");
      // Refresh file list
      const { data: newFiles, error: fetchErr } = await supabase.from("documents").select().eq("group_id", profile.group_id);
      if (fetchErr) {
        console.error('Supabase fetch error:', fetchErr);
        throw new Error(fetchErr.message || 'Failed to fetch files.');
      }
      setFiles(newFiles || []);
    } catch (err: any) {
      console.error('Upload error:', err);
      let message = 'Failed to upload file';
      if (err && typeof err === 'object') {
        if (err.message) message = err.message;
        else if (err.error_description) message = err.error_description;
        else message = JSON.stringify(err);
      } else if (typeof err === 'string') {
        message = err;
      }
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  // --- Robust Download Handler ---
  const handleDownload = async (fileUrl: string, name: string) => {
    try {
      const { data, error } = await supabase.storage.from('documents').download(fileUrl);
      if (error) {
        console.error('Supabase Storage download error:', error);
        setError(error.message || 'Failed to download file.');
        return;
      }
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Download error:', err);
      setError('Failed to download file.');
    }
  };

  // --- Robust Delete Handler ---
  const handleDelete = async (id: string, fileUrl: string) => {
    setUploading(true);
    setError("");
    try {
      const { error: storageErr } = await supabase.storage.from('documents').remove([fileUrl]);
      if (storageErr) {
        console.error('Supabase Storage delete error:', storageErr);
        throw new Error(storageErr.message || 'Failed to delete file from storage.');
      }
      const { error: dbErr } = await supabase.from('documents').delete().eq('id', id);
      if (dbErr) {
        console.error('Supabase DB delete error:', dbErr);
        throw new Error(dbErr.message || 'Failed to delete file metadata.');
      }
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      // Refresh file list
      const { data: newFiles, error: fetchErr } = await supabase.from("documents").select().eq("group_id", profile.group_id);
      if (fetchErr) {
        console.error('Supabase fetch error:', fetchErr);
        throw new Error(fetchErr.message || 'Failed to fetch files.');
      }
      setFiles(newFiles || []);
      setSuccess('File deleted successfully!');
    } catch (err: any) {
      console.error('Delete error:', err);
      let message = 'Failed to delete file';
      if (err && typeof err === 'object') {
        if (err.message) message = err.message;
        else if (err.error_description) message = err.error_description;
        else message = JSON.stringify(err);
      } else if (typeof err === 'string') {
        message = err;
      }
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  // Edit description logic
  const startEditDesc = (doc: unknown) => {
    setEditingDescId((doc as any).id);
    setDescEdit((doc as any).description || "");
  };
  const saveDesc = async (doc: unknown) => {
    await supabase.from("documents").update({ description: descEdit }).eq("id", (doc as any).id);
    setEditingDescId(null);
    setDescEdit("");
    // Refresh file list
    const { data: newFiles, error: fetchErr } = await supabase.from("documents").select().eq("group_id", profile.group_id);
    if (!fetchErr) setFiles(newFiles || []);
  };

  // Add comment logic
  const addComment = async (doc: unknown) => {
    if (!commentText[(doc as any).id]) return;
    setCommentLoading((doc as any).id);
    await supabase.from("document_comments").insert({
      document_id: (doc as any).id,
      user_id: profile.id,
      text: commentText[(doc as any).id],
      created_at: new Date().toISOString(),
    });
    setCommentText((prev) => ({ ...prev, [(doc as any).id]: "" }));
    setCommentLoading(null);
    // Refresh comments
    const { data, error } = await supabase.from("document_comments").select().eq("document_id", (doc as any).id);
    if (!error && data) setComments((prev) => ({ ...prev, [(doc as any).id]: data }));
  };

  // Filtered files
  const filtered = files.filter(f =>
    (!category || (f as any).category === category) &&
    (!search || (f as any).name.toLowerCase().includes(search.toLowerCase()) || ((f as any).description || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <ProtectedLayout>
      <SidebarLayout>
        <main className="p-4 sm:p-6 md:p-8 min-h-screen bg-background text-foreground">
          <div className="flex items-center gap-4 mb-4">
            <BackButton />
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 via-green-500 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">Documents</h1>
            <Button className="bg-gradient-to-r from-blue-600 via-green-500 to-yellow-400 text-white font-bold shadow-lg min-h-[44px] min-w-[44px] flex items-center gap-2" onClick={() => inputRef.current?.click()} aria-label="Upload Document">
              <PlusCircle className="w-5 h-5" /> Upload
            </Button>
          </div>
          <div className="w-full max-w-5xl flex flex-col gap-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <Input type="file" ref={inputRef} className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              <Input placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
              <select className="bg-gray-800 text-white font-bold border border-gray-700 rounded px-3 py-2 focus:border-blue-500" value={category} onChange={e => setCategory(e.target.value)} title="Filter by Category">
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
              <select className="bg-gray-800 text-white font-bold border border-gray-700 rounded px-3 py-2 focus:border-blue-500" value={fileProject} onChange={e => setFileProject(e.target.value)} title="Filter by Project">
                <option value="">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="bg-gradient-to-br from-blue-100 via-green-50 to-yellow-50 dark:from-blue-900 dark:via-green-900 dark:to-yellow-900 rounded-2xl shadow-2xl p-4 md:p-6 flex flex-col gap-4 mt-2 text-card-foreground">
              <div className="font-extrabold text-xl flex items-center gap-2 bg-gradient-to-r from-blue-600 via-green-500 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
                <FileText className="w-7 h-7" aria-label="Documents" /> Quick Upload
              </div>
              <div className="border-2 border-dashed border-blue-400 rounded p-6 text-center cursor-pointer bg-muted dark:bg-card hover:bg-blue-100 dark:hover:bg-blue-900" onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => inputRef.current?.click()}>
                {file ? (
                  <div>{file.name}</div>
                ) : (
                  <div>Drag and drop files here, or click to select files</div>
                )}
                <div className="text-xs text-gray-400 mt-2">Maximum file size: 50MB</div>
              </div>
              <form onSubmit={handleUpload} className="flex flex-col gap-4 mt-2">
                <div className="flex gap-4 items-center">
                  <label htmlFor="file-category-select" className="text-sm font-medium">Category</label>
                  <select
                    id="file-category-select"
                    className="bg-gray-800 text-white font-bold border border-gray-700 rounded px-3 py-2 focus:border-blue-500"
                    value={fileCategory}
                    onChange={e => setFileCategory(e.target.value)}
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat} className="bg-gray-800 text-white font-bold">{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                  <label htmlFor="file-project-select" className="text-sm font-medium">Assign to Project (Optional)</label>
                  <select
                    id="file-project-select"
                    className="bg-gray-800 text-white font-bold border border-gray-700 rounded px-3 py-2 focus:border-blue-500"
                    value={fileProject}
                    onChange={e => setFileProject(e.target.value)}
                  >
                    <option value="">No Project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <Input
                  placeholder="Describe what this document is about..."
                  value={fileDescription}
                  onChange={e => setFileDescription(e.target.value)}
                  className="w-full bg-muted dark:bg-card text-foreground"
                />
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full" disabled={uploading || !file || !profile}>{uploading ? "Uploading..." : "Upload"}</Button>
                {error && <div className="text-red-600 text-sm font-bold">{typeof error === 'object' ? JSON.stringify(error) : error}</div>}
                {success && <div className="text-green-600 text-sm">{success}</div>}
              </form>
            </div>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <div className="text-2xl font-bold mb-2">No documents found</div>
                <div className="mb-4">Upload your first document to get started</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mt-4">
                <div className="text-green-400 text-center font-bold mb-2">All teammates in this group can access, download, and comment on these documents.</div>
                {filtered.map(doc => (
                  <div key={doc.id} className="bg-white dark:bg-background rounded-2xl shadow-2xl p-4 md:p-6 flex flex-col gap-2 text-card-foreground min-w-0 w-full touch-manipulation">
                    <div className="font-extrabold text-lg flex items-center gap-2 bg-gradient-to-r from-blue-600 via-green-500 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
                      <FileText className="w-5 h-5" aria-label="Document" /> {(doc as any).name}
                      <Button size="icon" variant="ghost" onClick={() => startEditDesc(doc)} title="Edit Description" aria-label="Edit Description"><Pencil className="w-4 h-4" /></Button>
                    </div>
                    <div className="text-sm text-gray-600">{(doc as any).category && (doc as any).category.charAt(0).toUpperCase() + (doc as any).category.slice(1)}</div>
                    <div className="text-xs text-gray-500 font-bold">
                      Uploaded by: {(profiles.find(p => (p as any).id === (doc as any).uploaded_by)?.name || (doc as any).uploaded_by)}
                    </div>
                    <div className="text-xs text-gray-500">{(doc as any).file_type} • {Math.round((doc as any).file_size || 0 / 1024)} KB</div>
                    <div className="text-xs text-gray-500">Uploaded: {(doc as any).created_at ? new Date((doc as any).created_at).toLocaleString() : "-"}</div>
                    {editingDescId === (doc as any).id ? (
                      <div className="flex gap-2 items-center">
                        <Input value={descEdit} onChange={e => setDescEdit(e.target.value)} className="flex-1" />
                        <Button size="sm" onClick={() => saveDesc(doc)}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingDescId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-700">{(doc as any).description ? String((doc as any).description) : <span className="italic text-gray-400">No description</span>}</div>
                    )}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => handleDownload((doc as any).file_url, (doc as any).name)}>Download</Button>
                      <Button size="sm" variant="ghost" onClick={() => startEditDesc(doc)} title="Edit Description">Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete((doc as any).id, (doc as any).file_url)}>Delete</Button>
                    </div>
                    {(doc as any).project_id && <div className="text-xs text-blue-600">Project: {(projects.find(p => (p as any).id === (doc as any).project_id)?.name)}</div>}
                    {(doc as any).task_id && <div className="text-xs text-green-600">Task: {(tasks.find(t => (t as any).id === (doc as any).task_id)?.title)}</div>}
                    {/* Comments/Feedback Section */}
                    <div className="mt-2 border-t pt-2">
                      <div className="flex items-center gap-2 mb-1 font-semibold"><MessageCircle className="w-4 h-4" /> Feedback</div>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {(comments[(doc as any).id] || []).map((c) => (
                          <div key={c.id} className="text-xs text-gray-800 bg-gray-100 rounded px-2 py-1">
                            <span className="font-bold">{(c as any).user_id === profile.id ? "You" : (c as any).user_id}</span>: {(c as any).text}
                            <span className="text-gray-400 ml-2">{(c as any).created_at ? new Date((c as any).created_at).toLocaleString() : ""}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={commentText[(doc as any).id] || ""}
                          onChange={e => setCommentText(prev => ({ ...prev, [(doc as any).id]: e.target.value }))}
                          placeholder="Add feedback..."
                          className="flex-1"
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addComment(doc); } }}
                        />
                        <Button size="sm" onClick={() => addComment(doc)} disabled={commentLoading === (doc as any).id}>Add</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </SidebarLayout>
    </ProtectedLayout>
  );
} 