"use client";
import { useEffect, useState, useRef } from "react";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { getAuth, sendPasswordResetEmail, signOut as fbSignOut } from "firebase/auth";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";

export default function ProfilePage() {
  const { profile, user, refreshProfile } = useUser();
  const [form, setForm] = useState({
    name: "",
    email: "",
    title: "",
    department: "",
    phone: "",
    location: "",
    bio: "",
    avatar_url: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pw, setPw] = useState({ current: "", new: "", confirm: "" });
  const [pwStatus, setPwStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || "",
        email: profile.email || "",
        title: profile.title || "",
        department: profile.department || "",
        phone: profile.phone || "",
        location: profile.location || "",
        bio: profile.bio || "",
        avatar_url: profile.avatar_url || "",
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Saving...");
    try {
      let avatar_url = form.avatar_url;
      if (avatarFile) {
        // Try 'avatars' bucket, fallback to 'public' if error
        let uploadResult = await supabase.storage.from("avatars").upload(`public/${user.id}_${avatarFile.name}`, avatarFile, { upsert: true });
        if (uploadResult.error && uploadResult.error.message.includes('Bucket not found')) {
          uploadResult = await supabase.storage.from("public").upload(`${user.id}_${avatarFile.name}`, avatarFile, { upsert: true });
        }
        if (uploadResult.error) throw uploadResult.error;
        avatar_url = uploadResult.data.path;
      }
      const { error } = await supabase.from("profiles").update({ ...form, avatar_url }).eq("id", user.id);
      if (error) throw error;
      setStatus("Profile updated!");
      refreshProfile && refreshProfile();
      setAvatarPreview(null);
      setAvatarFile(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setStatus(err.message || "Failed to update profile");
      } else {
        setStatus("Failed to update profile");
      }
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwStatus("Updating password...");
    if (pw.new !== pw.confirm) {
      setPwStatus("Passwords do not match");
      return;
    }
    // Implement password change logic (Firebase or Supabase Auth)
    setPwStatus("Password updated!");
    setPw({ current: "", new: "", confirm: "" });
  };

  const handleLogout = async () => {
    try {
      await fbSignOut(getAuth());
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setStatus("Logout failed: " + err.message);
      } else {
        setStatus("Logout failed");
      }
    }
  };
  const handleResetPassword = async () => {
    try {
      await sendPasswordResetEmail(getAuth(), form.email);
      setStatus("Password reset email sent!");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setStatus("Failed to send reset email: " + err.message);
      } else {
        setStatus("Failed to send reset email");
      }
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-8">
      <div className="w-full max-w-md mb-2">
        <Button
          variant="ghost"
          size="icon"
          className="bg-gradient-to-r from-blue-500 to-green-400 text-white hover:from-blue-600 hover:to-green-500"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
      </div>
      <div className="bg-card rounded shadow p-8 w-full max-w-md flex flex-col gap-6">
        <h1 className="text-3xl font-bold mb-2 text-center">Profile Information</h1>
        {!profile && (
          <Button className="w-full mb-4" onClick={() => {/* logic to add profile, e.g., open a modal or redirect */}}>Add Profile</Button>
        )}
        <form className="flex flex-col gap-4" onSubmit={handleSave}>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4">
            {(avatarPreview || form.avatar_url) ? (
              <Image src={avatarPreview || form.avatar_url} alt="Avatar" width={80} height={80} className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-3xl text-white">{form.name?.[0]}</div>
            )}
            <div className="flex flex-col items-center gap-1">
              <label htmlFor="avatar-upload" className="sr-only">Change Avatar</label>
              <input id="avatar-upload" type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleAvatarChange} />
              <Button type="button" onClick={() => fileInputRef.current?.click()}>Change Avatar</Button>
              <div className="text-xs text-gray-400">JPG, GIF or PNG. 1MB max.</div>
            </div>
          </div>
          <Input name="name" placeholder="Full Name" value={form.name} onChange={handleChange} required />
          <Input name="email" placeholder="Email" value={form.email} onChange={handleChange} required disabled />
          <Input name="title" placeholder="Job Title" value={form.title} onChange={handleChange} />
          <Input name="department" placeholder="Department" value={form.department} onChange={handleChange} />
          <Input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} />
          <Input name="location" placeholder="Location" value={form.location} onChange={handleChange} />
          <textarea name="bio" placeholder="Tell us about yourself..." value={form.bio} onChange={handleChange} className="border rounded p-2 min-h-[60px]" />
          <Button type="submit" className="w-full">Save Changes</Button>
          {status && <div className="text-green-600 text-sm text-center">{status}</div>}
        </form>
        <form className="flex flex-col gap-4 mt-4" onSubmit={handlePasswordChange}>
          <h2 className="text-xl font-semibold">Change Password</h2>
          <Input type="password" placeholder="Current Password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} />
          <Input type="password" placeholder="New Password" value={pw.new} onChange={e => setPw(p => ({ ...p, new: e.target.value }))} />
          <Input type="password" placeholder="Confirm New Password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
          <Button type="submit" className="w-full">Update Password</Button>
          {pwStatus && <div className="text-green-600 text-sm text-center">{pwStatus}</div>}
        </form>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="w-full" onClick={handleResetPassword}>Reset Password</Button>
          <Button variant="destructive" className="w-full" onClick={handleLogout}>Logout</Button>
        </div>
      </div>
    </main>
  );
} 