"use client";

import ProtectedLayout from "../(auth)/protected-layout";
import SidebarLayout from "../SidebarLayout";
import { useState, useRef, useEffect } from "react";
import { geminiChat } from "@/lib/gemini";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/context/ThemeContext";
import { BackButton } from "@/components/ui/button";

const SUGGESTED = [
  "How can I improve my team's productivity?",
  "Suggest a workflow for project management.",
  "What are some tips for task prioritization?",
  "Summarize our current workspace activity.",
  "How can we optimize our document organization?"
];

// Define the correct type for messages
type MessageRole = "user" | "model";
type Message = { role: MessageRole; parts: { text: string }[] };

export default function AIPage() {
  const { profile } = useUser();
  const [messages, setMessages] = useState<Message[]>([
    { role: "model", parts: [{ text: "Hi! I'm your Gemini AI assistant. How can I help your workspace today?" }] }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>("");
  const [docText, setDocText] = useState<string>("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [includeContext, setIncludeContext] = useState(true);
  const { theme } = useTheme();

  // Fetch documents for the group
  useEffect(() => {
    if (!profile?.group_id) return;
    supabase.from("documents").select().eq("group_id", profile.group_id).then(({ data }) => {
      setDocuments(data || []);
    });
  }, [profile?.group_id]);

  // Fetch document text when selected
  useEffect(() => {
    async function fetchDocText() {
      if (!selectedDoc) { setDocText(""); return; }
      const doc = documents.find((d: any) => d.id === selectedDoc);
      if (!doc) { setDocText(""); return; }
      // Try to fetch text content (assume .txt or .md for demo)
      const { data, error } = await supabase.storage.from('documents').download(doc.file_url);
      if (error) { setDocText("[Could not load document text]"); return; }
      const text = await data.text();
      setDocText(text.slice(0, 4000)); // Limit for Gemini context
    }
    fetchDocText();
  }, [selectedDoc, documents]);

  // Fetch notifications for workspace context
  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from("notifications")
      .select()
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setNotifications(data || []));
  }, [profile?.id]);

  // Build workspace context string
  const workspaceContext = notifications.length > 0
    ? notifications.slice(0, 10).map(n => {
        if (n.type === "task_assigned") return `Task assigned: ${n.data?.title}`;
        if (n.type === "team_member_added") return `New teammate: ${n.data?.name}`;
        if (n.type === "team_member_removed") return `Teammate removed: ${n.data?.name}`;
        if (n.type === "team_member_updated") return `Teammate updated: ${n.data?.name}`;
        if (n.type === "project_assigned") return `Project assigned: ${n.data?.name}`;
        if (n.type === "document_tagged") return `Tagged in document: ${n.data?.title}`;
        return n.data?.message || n.type;
      }).join("\n")
    : "";

  // Enhanced send function with workspace context
  const send = async (text: string) => {
    setLoading(true);
    setError("");
    let userText = text;
    if (includeContext && workspaceContext) {
      userText = `Workspace context:\n${workspaceContext}\n\nUser: ${text}`;
    } else if (docText) {
      userText = `Document context:\n${docText}\n\nUser: ${text}`;
    }
    const newMessages: Message[] = [...messages, { role: "user", parts: [{ text: userText }] }];
    setMessages(newMessages);
    setInput("");
    try {
      const reply = await geminiChat(newMessages);
      setMessages([...newMessages, { role: "model", parts: [{ text: reply }] }]);
      setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
    } catch (err: any) {
      setError(err.message || "AI error");
    } finally {
      setLoading(false);
    }
  };

  // Suggested prompts based on notifications
  const dynamicSuggestions = [
    ...(notifications.some(n => n.type === "task_assigned") ? ["Summarize my new tasks"] : []),
    ...(notifications.some(n => n.type === "project_assigned") ? ["What are my current projects?"] : []),
    ...(notifications.some(n => n.type === "document_tagged") ? ["What documents was I tagged in?"] : []),
    "What should I focus on today?",
    ...SUGGESTED,
  ];

  return (
    <ProtectedLayout>
      <SidebarLayout>
        <main className={`p-8 min-h-screen flex flex-col items-center ${theme === 'dark' ? 'bg-background' : 'bg-gradient-to-br from-blue-100 to-green-100'}`}>
          <div className="flex items-center gap-4 mb-4">
            <BackButton />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-green-500 to-yellow-400 bg-clip-text text-transparent">AI Assistant</h1>
          </div>
          <div className="bg-card rounded shadow w-full max-w-2xl flex flex-col flex-1 text-card-foreground">
            <div className="p-4 border-b flex gap-4 items-center">
              <label htmlFor="doc-select" className="text-sm font-medium">Document Context:</label>
              <select id="doc-select" title="Document Context" className="border rounded p-2 bg-background text-foreground dark:bg-background dark:text-foreground" value={selectedDoc} onChange={e => setSelectedDoc(e.target.value)}>
                <option value="">None</option>
                {documents.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {docText && <span className="text-xs text-gray-500">{docText.length} chars</span>}
              <label className="ml-auto flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={includeContext} onChange={e => setIncludeContext(e.target.checked)} />
                <span className="text-xs font-bold">Workspace Context</span>
              </label>
            </div>
            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: 400, maxHeight: 500 }}>
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}> 
                  <div className={`rounded px-4 py-2 max-w-[80%] ${m.role === 'user' ? 'bg-blue-600 text-white' : theme === 'dark' ? 'bg-background text-card-foreground border border-blue-900' : 'bg-gray-100 text-gray-900'}`}>{m.parts[0].text}</div>
                </div>
              ))}
              {loading && <div className="text-blue-500 animate-pulse">Gemini is thinking...</div>}
            </div>
            <form className="flex gap-2 p-4 border-t" onSubmit={e => { e.preventDefault(); if (input.trim()) send(input); }}>
              <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask Gemini anything..." className="flex-1 bg-background text-foreground dark:bg-background dark:text-foreground" disabled={loading} />
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={loading || !input.trim()}>Send</Button>
            </form>
            {error && <div className="text-red-600 text-sm px-4 pb-2">{error}</div>}
            <div className="p-4 border-t bg-gray-50 dark:bg-background flex flex-wrap gap-2">
              {dynamicSuggestions.map((s, i) => (
                <Button key={i} variant="outline" size="sm" onClick={() => send(s)} disabled={loading}>{s}</Button>
              ))}
            </div>
          </div>
        </main>
      </SidebarLayout>
    </ProtectedLayout>
  );
} 