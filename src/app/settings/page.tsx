"use client";
import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const THEME_KEY = "oltech-theme";

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

async function sendPasswordReset(email: string) {
  const { sendPasswordResetEmail } = await import("firebase/auth");
  const { auth } = await import("@/lib/firebase");
  return sendPasswordResetEmail(auth, email);
}

export default function SettingsPage() {
  const { user, signOut } = useUser();
  const { theme, setTheme } = useTheme();
  const [status, setStatus] = useState("");
  const [pendingTheme, setPendingTheme] = useState(theme);
  const router = useRouter();

  const [notifications, setNotifications] = useState({
    task: false,
    meeting: false,
    project: false,
    weekly: false,
    taskPush: false,
    mentionPush: false,
    deadlinePush: false,
  });
  const [privacy, setPrivacy] = useState({
    public: false,
    email: false,
    phone: false,
    status: false,
    analytics: false,
    performance: false,
  });
  const allNotifications = Object.values(notifications).every(Boolean);
  const allPrivacy = Object.values(privacy).every(Boolean);

  // When theme context changes, update pendingTheme
  useEffect(() => { setPendingTheme(theme); }, [theme]);

  // Apply theme on mount and when changed
  useEffect(() => {
    let t = theme;
    if (t === "system") t = getSystemTheme();
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(t);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Load theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) setTheme(saved);
  }, []);

  // Listen for system theme changes if "system" is selected
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const t = mq.matches ? "dark" : "light";
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(t);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // Remove profile and password reset logic, keep only settings sections

  const handleSaveTheme = () => {
    setTheme(pendingTheme);
    setStatus("Theme saved!");
    setTimeout(() => setStatus(""), 1500);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-8">
      <div className="bg-card rounded shadow p-8 w-full max-w-md flex flex-col gap-6 relative">
        {/* Back arrow */}
        <button
          className="absolute top-4 left-4 p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          onClick={() => router.back()}
          title="Back"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1 className="text-3xl font-bold mb-2 text-center">Settings</h1>
        <section>
          <h2 className="text-xl font-semibold mb-2">Theme Customization</h2>
          <div className="flex gap-2 mb-4">
            <Button variant={pendingTheme === "light" ? "default" : "outline"} onClick={() => setPendingTheme("light")}>Light</Button>
            <Button variant={pendingTheme === "dark" ? "default" : "outline"} onClick={() => setPendingTheme("dark")}>Dark</Button>
            <Button variant={pendingTheme === "system" ? "default" : "outline"} onClick={() => setPendingTheme("system")}>System</Button>
          </div>
          <Button onClick={handleSaveTheme} className="w-full">Save Theme</Button>
          {status && <div className="text-green-600 text-sm mt-2 text-center">{status}</div>}
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-2">Notification Preferences</h2>
          <div className="flex flex-col gap-2">
            <label><input type="checkbox" checked={allNotifications} onChange={e => setNotifications(n => Object.fromEntries(Object.keys(n).map(k => [k, e.target.checked])))} /> Select All</label>
            <label><input type="checkbox" checked={notifications.task} onChange={e => setNotifications(n => ({ ...n, task: e.target.checked }))} /> Task assignments and updates</label>
            <label><input type="checkbox" checked={notifications.meeting} onChange={e => setNotifications(n => ({ ...n, meeting: e.target.checked }))} /> Meeting reminders</label>
            <label><input type="checkbox" checked={notifications.project} onChange={e => setNotifications(n => ({ ...n, project: e.target.checked }))} /> Project updates</label>
            <label><input type="checkbox" checked={notifications.weekly} onChange={e => setNotifications(n => ({ ...n, weekly: e.target.checked }))} /> Weekly summary</label>
            <label><input type="checkbox" checked={notifications.taskPush} onChange={e => setNotifications(n => ({ ...n, taskPush: e.target.checked }))} /> Task notifications (push)</label>
            <label><input type="checkbox" checked={notifications.mentionPush} onChange={e => setNotifications(n => ({ ...n, mentionPush: e.target.checked }))} /> Mentions and comments (push)</label>
            <label><input type="checkbox" checked={notifications.deadlinePush} onChange={e => setNotifications(n => ({ ...n, deadlinePush: e.target.checked }))} /> Deadline reminders (push)</label>
          </div>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-2">Privacy & Security</h2>
          <div className="flex flex-col gap-2">
            <label><input type="checkbox" checked={allPrivacy} onChange={e => setPrivacy(p => Object.fromEntries(Object.keys(p).map(k => [k, e.target.checked])))} /> Select All</label>
            <label><input type="checkbox" checked={privacy.public} onChange={e => setPrivacy(p => ({ ...p, public: e.target.checked }))} /> Public profile</label>
            <label><input type="checkbox" checked={privacy.email} onChange={e => setPrivacy(p => ({ ...p, email: e.target.checked }))} /> Show email address</label>
            <label><input type="checkbox" checked={privacy.phone} onChange={e => setPrivacy(p => ({ ...p, phone: e.target.checked }))} /> Show phone number</label>
            <label><input type="checkbox" checked={privacy.status} onChange={e => setPrivacy(p => ({ ...p, status: e.target.checked }))} /> Show activity status</label>
            <label><input type="checkbox" checked={privacy.analytics} onChange={e => setPrivacy(p => ({ ...p, analytics: e.target.checked }))} /> Usage analytics</label>
            <label><input type="checkbox" checked={privacy.performance} onChange={e => setPrivacy(p => ({ ...p, performance: e.target.checked }))} /> Performance tracking</label>
          </div>
        </section>
      </div>
    </main>
  );
} 