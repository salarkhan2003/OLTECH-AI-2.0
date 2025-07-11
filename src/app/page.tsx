"use client";
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-4xl font-bold">OLTECH AI Workspace</h1>
      <p className="text-lg">A complete workspace management platform for startups and high-performance teams.</p>
      <div className="flex gap-4">
        <Link href="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded">Go to Dashboard</Link>
        <Link href="/settings" className="px-4 py-2 bg-gray-700 text-white rounded">Settings</Link>
      </div>
    </main>
  );
}
