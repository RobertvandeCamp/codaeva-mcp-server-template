/**
 * Database types placeholder.
 *
 * Generate real types from your Supabase project:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/data-access/types.ts
 *
 * The generated types must include the '{{SUPABASE_SCHEMA}}' schema.
 */
export interface Database {
  '{{SUPABASE_SCHEMA}}': {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: string
          is_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: 'admin' | 'viewer'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type UserProfileRow = Database['{{SUPABASE_SCHEMA}}']['Tables']['user_profiles']['Row'];
