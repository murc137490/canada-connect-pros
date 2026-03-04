export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      pro_licenses: {
        Row: {
          created_at: string
          holder_name: string | null
          id: string
          is_verified: boolean | null
          license_number: string
          license_type: string
          pro_profile_id: string
          verification_data: Json | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          holder_name?: string | null
          id?: string
          is_verified?: boolean | null
          license_number: string
          license_type?: string
          pro_profile_id: string
          verification_data?: Json | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          holder_name?: string | null
          id?: string
          is_verified?: boolean | null
          license_number?: string
          license_type?: string
          pro_profile_id?: string
          verification_data?: Json | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pro_licenses_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          is_primary: boolean | null
          pro_profile_id: string
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          pro_profile_id: string
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          pro_profile_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_photos_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_profiles: {
        Row: {
          availability: string | null
          bio: string | null
          business_name: string
          created_at: string
          id: string
          is_verified: boolean | null
          latitude: number | null
          location: string | null
          longitude: number | null
          phone: string | null
          price_max: number | null
          price_min: number | null
          updated_at: string
          user_id: string
          website: string | null
          years_experience: number | null
        }
        Insert: {
          availability?: string | null
          bio?: string | null
          business_name: string
          created_at?: string
          id?: string
          is_verified?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          phone?: string | null
          price_max?: number | null
          price_min?: number | null
          updated_at?: string
          user_id: string
          website?: string | null
          years_experience?: number | null
        }
        Update: {
          availability?: string | null
          bio?: string | null
          business_name?: string
          created_at?: string
          id?: string
          is_verified?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          phone?: string | null
          price_max?: number | null
          price_min?: number | null
          updated_at?: string
          user_id?: string
          website?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      pro_services: {
        Row: {
          category_slug: string
          created_at: string
          custom_price_max: number | null
          custom_price_min: number | null
          description: string | null
          id: string
          pro_profile_id: string
          service_slug: string
        }
        Insert: {
          category_slug: string
          created_at?: string
          custom_price_max?: number | null
          custom_price_min?: number | null
          description?: string | null
          id?: string
          pro_profile_id: string
          service_slug: string
        }
        Update: {
          category_slug?: string
          created_at?: string
          custom_price_max?: number | null
          custom_price_min?: number | null
          description?: string | null
          id?: string
          pro_profile_id?: string
          service_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_services_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      review_photos: {
        Row: {
          created_at: string
          id: string
          review_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_photos_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_responses: {
        Row: {
          content: string
          created_at: string
          id: string
          pro_user_id: string
          review_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          pro_user_id: string
          review_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          pro_user_id?: string
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_responses_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          content: string | null
          created_at: string
          id: string
          pro_profile_id: string
          rating: number
          reviewer_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          pro_profile_id: string
          rating: number
          reviewer_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          pro_profile_id?: string
          rating?: number
          reviewer_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_pro_avg_rating: {
        Args: { p_pro_profile_id: string }
        Returns: {
          avg_rating: number
          review_count: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
