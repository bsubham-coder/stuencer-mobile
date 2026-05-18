import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://isfdaxoklxkkvakucrqg.supabase.co";
const SUPABASE_KEY = "sb_publishable_dMFHeY23t8pPv6IwPY5k4w__w84h6pd";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
