export type FilmStatus =
  | "uploading"
  | "processing"
  | "pending_review"
  | "approved"
  | "rejected";

// These are `type` aliases rather than `interface` on purpose: an interface
// never gets an implicit string index signature (even an empty one), so it
// fails to satisfy supabase-js's `Row/Insert/Update: Record<string, unknown>`
// constraint below. That failure doesn't surface as a type error here — it
// silently degrades `createClient<Database>()` so every table's rows,
// inserts, and rpc() calls resolve to `never` instead of being typed.
export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_filmmaker: boolean;
  created_at: string;
};

export type Film = {
  id: string;
  owner_id: string;
  title: string;
  synopsis: string | null;
  genre: string | null;
  tags: string[];
  duration_seconds: number | null;
  mux_upload_id: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  thumbnail_url: string | null;
  status: FilmStatus;
  rejection_reason: string | null;
  ad_tag_url: string | null;
  is_free_preview: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
};

export type SubscriptionStatus =
  | "active"
  | "expired"
  | "cancelled"
  | "in_grace_period"
  | "billing_issue";

export type Subscription = {
  user_id: string;
  revenuecat_app_user_id: string;
  entitlement_id: string;
  status: SubscriptionStatus;
  product_id: string | null;
  store: "app_store" | "play_store" | "stripe" | "promotional" | null;
  current_period_expires_at: string | null;
  updated_at: string;
};

export type WatchHistory = {
  user_id: string;
  film_id: string;
  progress_seconds: number;
  completed: boolean;
  updated_at: string;
};

export type Favorite = {
  user_id: string;
  film_id: string;
  created_at: string;
};

// Minimal typed shape for @supabase/supabase-js's generic client. Only the
// columns/tables above are modeled; extend as the schema grows.
//
// `Relationships` and the schema-level `Views`/`Functions` are required by
// supabase-js's GenericTable/GenericSchema types even when empty.
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      films: {
        Row: Film;
        Insert: Partial<Film> & { owner_id: string; title: string };
        Update: Partial<Film>;
        Relationships: [];
      };
      subscriptions: {
        Row: Subscription;
        Insert: Subscription;
        Update: Partial<Subscription>;
        Relationships: [];
      };
      watch_history: {
        Row: WatchHistory;
        Insert: Partial<WatchHistory> & { user_id: string; film_id: string };
        Update: Partial<WatchHistory>;
        Relationships: [];
      };
      favorites: { Row: Favorite; Insert: Favorite; Update: Partial<Favorite>; Relationships: [] };
    };
    Views: {};
    Functions: {
      increment_view_count: { Args: { p_film_id: string }; Returns: void };
    };
  };
};
