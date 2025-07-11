"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/context/UserContext";
import { Bell, Users, UserPlus, UserMinus, UserCog } from "lucide-react";
import { createPortal } from "react-dom";
import Image from "next/image";

export default function NotificationBell() {
  const { profile } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch notifications
  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from("notifications")
      .select()
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setNotifications(data || []));
  }, [profile?.id]);

  // Real-time subscription
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  // Mark as read
  const markAsRead = async (id) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Notification icon and text by type
  function renderNotification(n) {
    if (n.type === "task_assigned") {
      return (
        <>
          <Users className="w-5 h-5 text-blue-500 mr-2" />
          <span>You were assigned a task: <b>{n.data?.title}</b></span>
        </>
      );
    }
    if (n.type === "team_member_added") {
      return (
        <>
          <UserPlus className="w-5 h-5 text-green-500 mr-2" />
          <span>New teammate <b>{n.data?.name}</b> joined your team!</span>
        </>
      );
    }
    if (n.type === "team_member_removed") {
      return (
        <>
          <UserMinus className="w-5 h-5 text-red-500 mr-2" />
          <span>Teammate <b>{n.data?.name}</b> was removed from your team.</span>
        </>
      );
    }
    if (n.type === "team_member_updated") {
      return (
        <>
          <UserCog className="w-5 h-5 text-yellow-500 mr-2" />
          <span>Teammate <b>{n.data?.name}</b>'s info was updated.</span>
        </>
      );
    }
    // fallback
    return (
      <>
        <Bell className="w-5 h-5 text-gray-400 mr-2" />
        <span>{n.data?.message || "Notification"}</span>
      </>
    );
  }

  // Vibrant, modern dropdown UI
  const dropdown = (
    <div
      ref={dropdownRef}
      className="fixed top-16 left-1/2 -translate-x-1/2 w-[90vw] max-w-md bg-gradient-to-br from-blue-600 via-green-400 to-yellow-300 shadow-2xl rounded-2xl p-4 z-[9999] border-4 border-white animate-fade-in"
      style={{ minWidth: 320 }}
    >
      <h4 className="font-extrabold text-lg text-white mb-3 flex items-center gap-2">
        <Bell className="w-6 h-6 animate-bounce" /> Notifications
      </h4>
      {notifications.length === 0 && <div className="text-white/80 text-center py-8">No notifications</div>}
      <ul className="flex flex-col gap-2 max-h-96 overflow-y-auto">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all border-2 ${!n.read ? "bg-white/80 border-blue-400 shadow-lg scale-105" : "bg-white/40 border-transparent"}`}
            onClick={() => markAsRead(n.id)}
          >
            {n.data?.avatar_url && (
              <Image src={n.data.avatar_url} alt="avatar" width={32} height={32} className="w-8 h-8 rounded-full border-2 border-white shadow mr-2" />
            )}
            {renderNotification(n)}
            <span className="ml-auto text-xs text-gray-600 font-bold">{new Date(n.created_at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative">
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs px-1">
            {unreadCount}
          </span>
        )}
      </button>
      {open && createPortal(dropdown, document.body)}
    </div>
  );
} 