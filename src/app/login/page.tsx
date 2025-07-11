"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.replace("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-black">
      <form onSubmit={handleLogin} className="bg-gray-900 p-8 rounded shadow-md w-full max-w-sm flex flex-col gap-4 border border-gray-700">
        <h2 className="text-2xl font-bold text-center mb-2 text-white">Login to OLTECH AI</h2>
        <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="bg-gray-800 text-white font-bold placeholder-gray-400 border-gray-700 focus:border-blue-500" />
        <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="bg-gray-800 text-white font-bold placeholder-gray-400 border-gray-700 focus:border-blue-500" />
        {error && <div className="text-red-400 text-sm font-bold">{error}</div>}
        <Button type="submit" disabled={loading} className="bg-blue-700 hover:bg-blue-800 text-white font-bold">{loading ? "Logging in..." : "Login"}</Button>
        <Button type="button" onClick={handleGoogle} className="bg-red-600 hover:bg-red-700 text-white font-bold">Sign in with Google</Button>
        <div className="text-center text-sm mt-2 text-white font-bold">Don't have an account? <a href="/signup" className="text-blue-400 underline font-bold">Sign Up</a></div>
      </form>
    </main>
  );
} 