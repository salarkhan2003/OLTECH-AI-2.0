"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from "react";
import { UserCircle2, LogOut, Settings, User, BarChart3, CheckCircle2, FolderKanban, Users, FileText, Calendar, Sparkles, PieChart, MessageCircle } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const [menuOpen, setMenuOpen] = useState(false);
  const { profile, signOut } = useUser();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return isAuthPage ? (
    <main>{children}</main>
  ) : (
    <div className="min-h-screen flex flex-row">
      {/* Sidebar */}
      <aside className="w-56 min-h-screen bg-gradient-to-b from-blue-700 via-green-500 to-yellow-400 dark:from-blue-900 dark:via-green-900 dark:to-yellow-900 text-white flex flex-col p-4 gap-2 shadow-2xl rounded-tr-3xl rounded-br-3xl border-r-4 border-blue-300/40 z-10 transition-all duration-200 font-sans">
        <nav className="flex flex-col gap-2 mt-4">
          <SidebarLink href="/dashboard" icon="BarChart3" label="Dashboard" />
          <SidebarLink href="/tasks" icon="CheckCircle2" label="Tasks" />
          <SidebarLink href="/projects" icon="FolderKanban" label="Projects" />
          <SidebarLink href="/team" icon="Users" label="Team" />
          <SidebarLink href="/documents" icon="FileText" label="Documents" />
          <SidebarLink href="/calendar" icon="Calendar" label="Calendar" />
          <SidebarLink href="/ai" icon="Sparkles" label="AI Assistant" />
          <SidebarLink href="/settings" icon="Settings" label="Settings" />
        </nav>
        <div className="flex-1" />
        <div className="mt-8 flex flex-col gap-2 text-xs text-blue-100/80 font-semibold">
          <span className="opacity-70">OLTECH AI Platform</span>
          <span className="opacity-50">© {new Date().getFullYear()}</span>
        </div>
      </aside>
      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header with profile menu */}
        <header className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-900 via-green-900 to-yellow-900 shadow-xl z-20">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-extrabold bg-gradient-to-r from-blue-400 to-green-300 bg-clip-text text-transparent drop-shadow-lg">OLTECH AI</span>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 transition px-2 py-1 hover:bg-blue-800/30"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Open profile menu"
            >
              {profile?.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.name} width={36} height={36} className="w-9 h-9 rounded-full border-2 border-blue-300 shadow" />
              ) : (
                <UserCircle2 className="w-9 h-9 text-blue-400" />
              )}
              <span className="font-bold text-white hidden sm:block max-w-[120px] truncate">{profile?.name || "Profile"}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-2xl py-2 z-50 border border-blue-200">
                <button
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900 text-left text-black dark:text-white"
                  onClick={() => { setMenuOpen(false); router.push("/profile"); }}
                >
                  <User className="w-5 h-5" /> Profile
                </button>
                <button
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900 text-left text-black dark:text-white"
                  onClick={() => { setMenuOpen(false); router.push("/settings"); }}
                >
                  <Settings className="w-5 h-5" /> Settings
                </button>
                <button
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-red-100 dark:hover:bg-red-900 text-left text-red-600 dark:text-red-400 font-bold border-t border-blue-100 dark:border-blue-800 mt-1"
                  onClick={async () => { setMenuOpen(false); await signOut(); router.replace("/login"); }}
                >
                  <LogOut className="w-5 h-5" /> Logout
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto bg-background text-foreground">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarLink({ href, icon, label }: { href: string, icon: string, label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  const Icon = {
    BarChart3, CheckCircle2, FolderKanban, Users, FileText, Calendar, Sparkles, PieChart, Settings, MessageCircle
  }[icon];
  // Remove Analytics button by not rendering it
  if (label === "Analytics") return null;
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-lg transition-all duration-150 shadow-md hover:scale-105 hover:bg-white/10 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400 ${isActive ? 'bg-gradient-to-r from-blue-400 to-green-300 text-white shadow-2xl scale-105' : 'bg-white/0 text-white/90'}`}
      aria-current={isActive ? "page" : undefined}
    >
      {Icon && <Icon className="w-6 h-6 drop-shadow-lg" />}
      <span className="truncate">{label}</span>
    </Link>
  );
} 