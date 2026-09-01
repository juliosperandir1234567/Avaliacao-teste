import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { Profile } from "./types";

export async function getCurrentProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nome, email, role, ativo")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  return profile as Profile;
}
