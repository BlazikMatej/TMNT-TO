const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://lxbwfwkyulpwscnhcmkb.supabase.co/rest/v1/";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4Yndmd2t5dWxwd3NjbmhjbWtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjQ4MTcsImV4cCI6MjA5MjM0MDgxN30.IPoRs-suTT2wCymiMaG27iXjlO2xB42Gff-s64q7iwI";

const cleanedSupabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, "");

const createSupabaseClient = (key = supabaseKey) =>
  createClient(cleanedSupabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

module.exports = {
  supabaseUrl,
  supabaseKey,
  supabaseServiceRoleKey: supabaseKey,
  cleanedSupabaseUrl,
  createSupabaseClient,
};
