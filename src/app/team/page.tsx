"use client";

import ProtectedLayout from "../(auth)/protected-layout";
import SidebarLayout from "../SidebarLayout";
import { useUser } from "@/context/UserContext";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { UserCircle2, ShieldCheck, Users, PlusCircle } from "lucide-react";
import { sendTeamNotification } from "@/lib/utils";
import { BackButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function TeamPage() {
  const { profile } = useUser();
  const [members, setMembers] = useState<any[]>([]);
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState(group?.name || "");
  const [editGroupLoading, setEditGroupLoading] = useState(false);
  const [editGroupError, setEditGroupError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile?.group_id) return;
    setLoading(true);
    Promise.all([
      supabase.from("profiles").select().eq("group_id", profile.group_id),
      supabase.from("groups").select().eq("id", profile.group_id).single(),
    ]).then(([membersRes, groupRes]) => {
      if (membersRes.error) setError(membersRes.error.message);
      else setMembers(membersRes.data || []);
      if (groupRes.error) setError(groupRes.error.message);
      else setGroup(groupRes.data);
      setLoading(false);
    });
    // --- Real-time subscriptions for team (profiles) and group (groups) ---
    const memberChannel = supabase.channel('team-members')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `group_id=eq.${profile.group_id}` }, () => {
        supabase.from("profiles").select().eq("group_id", profile.group_id).then(({ data }) => setMembers(data || []));
      })
      .subscribe();
    const groupChannel = supabase.channel('team-group')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${profile.group_id}` }, () => {
        supabase.from("groups").select().eq("id", profile.group_id).single().then(({ data }) => setGroup(data));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(memberChannel);
      supabase.removeChannel(groupChannel);
    };
  }, [profile?.group_id]);

  return (
    <ProtectedLayout>
      <SidebarLayout>
        <main className="p-4 sm:p-6 md:p-8 min-h-screen bg-background text-foreground">
          <div className="flex items-center gap-4 mb-4">
            <BackButton />
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 via-green-500 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">Team</h1>
            <Button className="bg-gradient-to-r from-blue-600 via-green-500 to-yellow-400 text-white font-bold shadow-lg min-h-[44px] min-w-[44px] flex items-center gap-2" onClick={() => setShowCode(true)} aria-label="Invite Member">
              <PlusCircle className="w-5 h-5" /> Invite Member
            </Button>
          </div>
          <div className="max-w-5xl mx-auto">
            <div className="bg-gradient-to-br from-blue-100 via-green-50 to-yellow-50 dark:from-blue-900 dark:via-green-900 dark:to-yellow-900 rounded-2xl shadow-2xl p-4 md:p-6 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-card-foreground">
              <div>
                <div className="text-2xl font-extrabold flex items-center gap-2 bg-gradient-to-r from-blue-600 via-green-500 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
                  <Users className="w-7 h-7" aria-label="Team" />
                  {group?.name || "OLTECH GROUP"}
                </div>
                <div className="text-gray-500 text-sm mb-2">{group?.description || "No description provided"}</div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">Join Code:</span> <span className="font-mono bg-gray-800 rounded px-2 py-1 text-white font-bold border border-gray-700">{group?.join_code || "-"}</span>
                  <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(group?.join_code || ""); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied!" : "Copy"}</Button>
                </div>
                <div className="text-xs text-gray-400 mt-1">Created {group?.created_at ? new Date(group.created_at).toLocaleDateString() : "-"}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {profile?.role === "admin" && group && (
                  <Button variant="outline" onClick={() => setShowEditGroup(true)}>Edit Group Name</Button>
                )}
                <div className="text-xs text-gray-400 mt-2 font-bold">
                  Group created by: {members.find(m => m.id === group?.created_by)?.name || "Unknown"}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {members.map(member => (
                <div key={member.id} className="bg-white dark:bg-background rounded-2xl shadow-2xl p-4 md:p-6 flex flex-col gap-2 cursor-pointer hover:ring-2 hover:ring-blue-400 transition text-card-foreground min-w-0 w-full touch-manipulation" onClick={() => setSelected(member)}>
                  <div className="flex items-center gap-4 mb-2">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt={member.name} className="w-16 h-16 rounded-full border-2 border-blue-200 shadow-lg" />
                    ) : (
                      <UserCircle2 className="w-16 h-16 text-blue-500" />
                    )}
                    <div>
                      <div className="text-lg font-bold flex items-center gap-2">{member.name} {member.role === "admin" && <ShieldCheck className="w-5 h-5 text-green-600" title="Admin" />}</div>
                      <div className="text-xs text-gray-500">Joined {member.created_at ? new Date(member.created_at).toLocaleDateString() : "-"}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <div><span className="font-semibold">Role:</span> {member.role}</div>
                    {member.title && <div><span className="font-semibold">Title:</span> {member.title}</div>}
                    {member.department && <div><span className="font-semibold">Department:</span> {member.department}</div>}
                    {member.email && <div className="font-semibold break-all truncate max-w-[180px]">Email: {member.email}</div>}
                    {member.phone && <div><span className="font-semibold">Phone:</span> {member.phone}</div>}
                    {member.location && <div><span className="font-semibold">Location:</span> {member.location}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {showCode && group && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-card p-6 rounded shadow w-full max-w-xs flex flex-col gap-4 items-center text-card-foreground">
                <h2 className="text-xl font-bold mb-2">Workspace Join Code</h2>
                <input
                  value={group.join_code}
                  readOnly
                  aria-label="Team Join Code"
                  className="bg-gray-800 text-white font-bold border-gray-700 placeholder:text-gray-400 rounded px-3 py-1 mr-2 w-24 font-mono text-lg text-center outline-none"
                />
                <Button onClick={async () => {
                  await navigator.clipboard.writeText(group.join_code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }} className="bg-green-600 hover:bg-green-700 text-white w-full">{copied ? "Copied!" : "Copy Code"}</Button>
                <Button onClick={() => setShowCode(false)} variant="outline" className="w-full">Close</Button>
              </div>
            </div>
          )}
        {selected && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded shadow w-full max-w-md flex flex-col gap-4 items-center text-card-foreground">
              {selected.avatar_url ? (
                <img src={selected.avatar_url} alt={selected.name} className="w-20 h-20 rounded-full" />
              ) : (
                <UserCircle2 className="w-20 h-20 text-blue-500" />
              )}
              <div className="text-2xl font-bold flex items-center gap-2">{selected.name} {selected.role === "admin" && <ShieldCheck className="w-5 h-5 text-green-600" title="Admin" />}</div>
              <div className="text-gray-700 text-sm">{selected.email}</div>
              {selected.phone && <div className="text-gray-700 text-sm">Phone: {selected.phone}</div>}
              {selected.location && <div className="text-gray-700 text-sm">Location: {selected.location}</div>}
              {selected.title && <div className="text-gray-700 text-sm">Title: {selected.title}</div>}
              {selected.department && <div className="text-gray-700 text-sm">Department: {selected.department}</div>}
              {selected.bio && <div className="text-gray-700 text-sm">Bio: {selected.bio}</div>}
              {selected.created_at && <div className="text-gray-500 text-xs">Member since: {new Date(selected.created_at).toLocaleDateString()}</div>}
              <div className="text-xs text-gray-500 mt-2">Role: {selected.role}</div>
              {profile?.role === "admin" && selected.id !== profile.id && (
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" disabled={actionLoading} onClick={async () => {
                    setActionLoading(true);
                    await supabase.from("profiles").update({ role: selected.role === "admin" ? "member" : "admin" }).eq("id", selected.id);
                    setSelected((m: any) => ({ ...m, role: m.role === "admin" ? "member" : "admin" }));
                    // Notify team about role update
                    await sendTeamNotification(
                      profile.group_id,
                      "team_member_updated",
                      {
                        name: selected.name,
                        avatar_url: selected.avatar_url,
                        action: selected.role === "admin" ? "demoted" : "promoted",
                        by: profile.name,
                      },
                      profile.id
                    );
                    setActionLoading(false);
                  }}>{selected.role === "admin" ? "Demote to Member" : "Promote to Admin"}</Button>
                  <Button size="sm" variant="destructive" disabled={actionLoading} onClick={() => setConfirmRemove(true)}>Remove</Button>
                </div>
              )}
              <Button onClick={() => setSelected(null)}>Close</Button>
              {confirmRemove && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                  <div className="bg-card rounded shadow flex flex-col gap-4 items-center text-card-foreground">
                    <div className="text-lg font-bold">Remove {selected.name}?</div>
                    <div className="text-sm text-gray-600">This will remove the member from the workspace.</div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="destructive" disabled={actionLoading} onClick={async () => {
                        setActionLoading(true);
                        await supabase.from("profiles").update({ group_id: null, role: null }).eq("id", selected.id);
                        // Notify team about removal
                        await sendTeamNotification(
                          profile.group_id,
                          "team_member_removed",
                          {
                            name: selected.name,
                            avatar_url: selected.avatar_url,
                            by: profile.name,
                          },
                          profile.id
                        );
                        setSelected(null);
                        setConfirmRemove(false);
                        setActionLoading(false);
                      }}>Confirm Remove</Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmRemove(false)}>Cancel</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {showEditGroup && group && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded shadow w-full max-w-xs flex flex-col gap-4 items-center text-card-foreground">
              <h2 className="text-xl font-bold mb-2">Edit Group Name</h2>
              <input className="border rounded p-2 w-full" value={editGroupName} onChange={e => setEditGroupName(e.target.value)} placeholder="Group Name" />
              {editGroupError && <div className="text-red-600 text-sm">{editGroupError}</div>}
              <div className="flex gap-2 mt-2">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={editGroupLoading} onClick={async () => {
                  setEditGroupLoading(true);
                  setEditGroupError("");
                  try {
                    const { error } = await supabase.from("groups").update({ name: editGroupName }).eq("id", group.id);
                    if (error) throw error;
                    setGroup((g: any) => ({ ...g, name: editGroupName }));
                    setShowEditGroup(false);
                  } catch (err: any) {
                    setEditGroupError(err.message || "Failed to update group name");
                  } finally {
                    setEditGroupLoading(false);
                  }
                }}>Save</Button>
                <Button variant="outline" onClick={() => setShowEditGroup(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}
        </main>
      </SidebarLayout>
    </ProtectedLayout>
  );
} 