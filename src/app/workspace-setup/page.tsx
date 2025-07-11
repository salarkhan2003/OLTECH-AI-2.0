"use client";

import ProtectedLayout from "../(auth)/protected-layout";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";

interface Group {
  id: string;
  name: string;
  join_code: string;
}

function generateJoinCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function WorkspaceSetupPage() {
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdGroup, setCreatedGroup] = useState<{ code: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const { user, profile, forceRefreshProfile } = useUser();
  const router = useRouter();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const code = generateJoinCode();
      // 1. Create group
      const { data: group, error: groupErr } = await supabase
        .from("groups")
        .insert({ name: workspaceName, join_code: code })
        .select()
        .single();
      if (groupErr) throw groupErr;
      // 2. Update profile as admin
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ group_id: group.id, role: "admin" })
        .eq("id", user?.uid);
      if (profErr) throw profErr;
      setCreatedGroup({ code: group.join_code, name: group.name });
      if (forceRefreshProfile) await forceRefreshProfile();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Failed to create workspace");
      } else {
        setError("Failed to create workspace due to an unknown error.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // 1. Find group by join code
      const { data: group, error: groupErr } = await supabase
        .from("groups")
        .select()
        .eq("join_code", joinCode)
        .single();
      if (groupErr || !group) throw new Error("Invalid join code");
      // 2. Check user authentication and profile details
      if (!user || !profile || !profile.email || !profile.name) {
        setError("You must be signed in with a valid email and name to join a workspace.");
        setLoading(false);
        router.replace("/login");
        return;
      }
      // 3. Update profile as member
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ group_id: group.id, role: "member" })
        .eq("id", user?.uid);
      if (profErr) throw profErr;
      if (forceRefreshProfile) await forceRefreshProfile();
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Failed to join workspace");
      } else {
        setError("Failed to join workspace due to an unknown error.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedLayout>
      <main className="flex flex-col items-center justify-center min-h-screen bg-black">
        <div className="bg-gray-900 p-8 rounded shadow-md w-full max-w-md flex flex-col gap-6 border border-gray-700">
          <h1 className="text-2xl font-bold text-center text-white">Workspace Setup</h1>
          {!mode && (
            <div className="flex flex-col gap-4">
              <Button className="bg-blue-700 hover:bg-blue-800 text-white font-bold" onClick={() => setMode('create')}>Create New Workspace</Button>
              <Button className="bg-green-700 hover:bg-green-800 text-white font-bold" onClick={() => setMode('join')}>Join Existing Workspace</Button>
            </div>
          )}
          {mode === 'create' && !createdGroup && (
            <form className="flex flex-col gap-4" onSubmit={handleCreate}>
              <Input placeholder="Workspace Name" value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} required className="bg-gray-800 text-white font-bold placeholder-gray-400 border-gray-700 focus:border-blue-500" />
              {error && <div className="text-red-400 text-sm font-bold">{error}</div>}
              <Button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white font-bold" disabled={loading}>{loading ? "Creating..." : "Create Workspace"}</Button>
              <Button variant="outline" type="button" onClick={() => setMode(null)} className="text-white font-bold border-gray-600">Back</Button>
            </form>
          )}
          {mode === 'create' && createdGroup && (
            <div className="flex flex-col gap-4 items-center">
              <div className="text-green-400 font-bold text-lg">Workspace "{createdGroup.name}" created!</div>
              <div className="text-center text-white">Share this join code with your teammates:</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-mono bg-gray-800 rounded px-4 py-2 select-all border border-gray-700 text-white">{createdGroup.code}</div>
                <button
                  type="button"
                  className="p-2 bg-blue-900 hover:bg-blue-800 rounded"
                  onClick={() => {
                    navigator.clipboard.writeText(createdGroup.code);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  title="Copy join code"
                >
                  <Copy className="w-5 h-5 text-white" />
                </button>
                {copied && <span className="text-green-400 text-sm ml-2">Copied!</span>}
              </div>
              <Button className="bg-blue-700 hover:bg-blue-800 text-white font-bold" onClick={async () => {
                if (forceRefreshProfile) await forceRefreshProfile();
                router.push('/dashboard');
              }}>Continue to Dashboard</Button>
            </div>
          )}
          {mode === 'join' && (
            <form className="flex flex-col gap-4" onSubmit={handleJoin}>
              <Input placeholder="Enter Join Code" value={joinCode} onChange={e => setJoinCode(e.target.value)} required className="bg-gray-800 text-white font-bold placeholder-gray-400 border-gray-700 focus:border-green-500" />
              {error && <div className="text-red-400 text-sm font-bold">{error}</div>}
              <Button type="submit" className="bg-green-700 hover:bg-green-800 text-white font-bold" disabled={loading}>{loading ? "Joining..." : "Join Workspace"}</Button>
              <Button variant="outline" type="button" onClick={() => setMode(null)} className="text-white font-bold border-gray-600">Back</Button>
            </form>
          )}
        </div>
      </main>
    </ProtectedLayout>
  );
} 