import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { supabase } from "@/lib/supabase";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Send a notification to all team members in a group.
 * @param group_id - The group ID
 * @param type - Notification type (e.g., 'team_member_added')
 * @param data - Notification data (object)
 * @param excludeUserId - Optionally exclude a user (e.g., the actor)
 */
export async function sendTeamNotification(group_id: string, type: string, data: any, excludeUserId?: string) {
  // Fetch all team members
  const { data: members, error } = await supabase.from("profiles").select("id").eq("group_id", group_id);
  if (error) return;
  const targets = members.filter((m: any) => m.id !== excludeUserId);
  if (targets.length === 0) return;
  // Insert notifications for each member
  await supabase.from("notifications").insert(
    targets.map((m: any) => ({
      user_id: m.id,
      type,
      data,
      read: false,
      created_at: new Date().toISOString(),
    }))
  );
}
