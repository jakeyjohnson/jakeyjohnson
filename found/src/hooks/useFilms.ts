import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Film } from "@/types/database";

export function useFilms() {
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("films")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setFilms(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { films, loading, error, reload: load };
}

export function useMyFilms(ownerId: string | undefined) {
  const [films, setFilms] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ownerId) {
      setFilms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("films")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    setFilms(data ?? []);
    setLoading(false);
  }, [ownerId]);

  useEffect(() => {
    load();
  }, [load]);

  return { films, loading, reload: load };
}
