// Public client configuration. The anon key is designed to be public: data access is enforced by
// row-level security in the database, so each user can only ever read and write their own rows.
export const CONFIG = {
  url: 'https://mjakuyzdlzvgxbywqvxy.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qYWt1eXpkbHp2Z3hieXdxdnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MDA0NzQsImV4cCI6MjEwNzM3NjQ3NH0.G48I5bmk9OlsQ6e7ZsigqoNzCAADe7FMO3zGOg479-o'
};
