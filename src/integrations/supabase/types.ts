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
          approval_baseline_json: Json | null
          availability: string | null
          banner_image_url: string | null
          bio: string | null
          business_name: string
          cancel_return_discount_consumed_at: string | null
          cancel_return_discount_pending: boolean
          legal_business_name: string | null
          business_address: string | null
          gst_registration_number: string | null
          qst_registration_number: string | null
          created_at: string
          email_language: string | null
          id: string
          id_document_url: string | null
          is_verified: boolean | null
          latitude: number | null
          location: string | null
          longitude: number | null
          personal_photo_url: string | null
          phone: string | null
          price_max: number | null
          price_min: number | null
          primary_category_slug: string | null
          profile_last_edited_at: string | null
          pro_accent_color: string | null
          referral_invite_panel_enabled: boolean
          service_at_workspace_only: boolean | null
          service_radius_km: number | null
          service_tags: string[] | null
          subscription_tier: string | null
          updated_at: string
          user_id: string
          website: string | null
          years_experience: number | null
          square_location_id: string | null
        }
        Insert: {
          availability?: string | null
          banner_image_url?: string | null
          bio?: string | null
          business_name: string
          cancel_return_discount_consumed_at?: string | null
          cancel_return_discount_pending?: boolean
          legal_business_name?: string | null
          business_address?: string | null
          gst_registration_number?: string | null
          qst_registration_number?: string | null
          created_at?: string
          email_language?: string | null
          id?: string
          id_document_url?: string | null
          is_verified?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          personal_photo_url?: string | null
          phone?: string | null
          price_max?: number | null
          price_min?: number | null
          primary_category_slug?: string | null
          pro_accent_color?: string | null
          referral_invite_panel_enabled?: boolean
          service_at_workspace_only?: boolean | null
          service_radius_km?: number | null
          service_tags?: string[] | null
          subscription_tier?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          years_experience?: number | null
          square_location_id?: string | null
        }
        Update: {
          availability?: string | null
          banner_image_url?: string | null
          bio?: string | null
          business_name?: string
          cancel_return_discount_consumed_at?: string | null
          cancel_return_discount_pending?: boolean
          legal_business_name?: string | null
          business_address?: string | null
          gst_registration_number?: string | null
          qst_registration_number?: string | null
          created_at?: string
          email_language?: string | null
          id?: string
          id_document_url?: string | null
          is_verified?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          personal_photo_url?: string | null
          phone?: string | null
          price_max?: number | null
          price_min?: number | null
          primary_category_slug?: string | null
          pro_accent_color?: string | null
          referral_invite_panel_enabled?: boolean
          service_at_workspace_only?: boolean | null
          service_radius_km?: number | null
          service_tags?: string[] | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          years_experience?: number | null
          square_location_id?: string | null
        }
        Relationships: []
      }
      pro_square_tokens: {
        Row: {
          access_token: string
          expires_at: string | null
          merchant_id: string
          pro_profile_id: string
          refresh_token: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          expires_at?: string | null
          merchant_id: string
          pro_profile_id: string
          refresh_token?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          expires_at?: string | null
          merchant_id?: string
          pro_profile_id?: string
          refresh_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_square_tokens_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: true
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_services: {
        Row: {
          category_slug: string
          created_at: string
          custom_price_max: number | null
          custom_price_min: number | null
          description: string | null
          display_name: string | null
          duration_minutes: number | null
          id: string
          pro_profile_id: string
          service_slug: string
          auto_reply_message?: string | null
          renewal_interval_months?: number | null
        }
        Insert: {
          category_slug: string
          created_at?: string
          custom_price_max?: number | null
          custom_price_min?: number | null
          description?: string | null
          display_name?: string | null
          duration_minutes?: number | null
          id?: string
          pro_profile_id: string
          service_slug: string
          auto_reply_message?: string | null
          renewal_interval_months?: number | null
        }
        Update: {
          category_slug?: string
          created_at?: string
          custom_price_max?: number | null
          custom_price_min?: number | null
          description?: string | null
          display_name?: string | null
          duration_minutes?: number | null
          id?: string
          pro_profile_id?: string
          service_slug?: string
          auto_reply_message?: string | null
          renewal_interval_months?: number | null
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
      pro_subscriptions: {
        Row: {
          billing_cycle_days: number
          billing_start: string
          plan_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle_days?: number
          billing_start?: string
          plan_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle_days?: number
          billing_start?: string
          plan_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      client_saved_pros: {
        Row: {
          created_at: string
          id: string
          pro_profile_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pro_profile_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pro_profile_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_saved_pros_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          birthday: string | null
          booking_id_verification_photo_path: string | null
          created_at: string
          email_language: string | null
          full_name: string | null
          id: string
          is_platform_admin: boolean
          phone: string | null
          postal_code: string | null
          public_user_number: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          birthday?: string | null
          booking_id_verification_photo_path?: string | null
          created_at?: string
          email_language?: string | null
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean
          phone?: string | null
          postal_code?: string | null
          public_user_number?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          birthday?: string | null
          booking_id_verification_photo_path?: string | null
          created_at?: string
          email_language?: string | null
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean
          phone?: string | null
          postal_code?: string | null
          public_user_number?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      service_browse_stats: {
        Row: {
          browse_count: number
          category_slug: string
          service_slug: string
          updated_at: string
        }
        Insert: {
          browse_count?: number
          category_slug: string
          service_slug: string
          updated_at?: string
        }
        Update: {
          browse_count?: number
          category_slug?: string
          service_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          id: string
          name: string
          price_cents: number
        }
        Insert: {
          id: string
          name: string
          price_cents: number
        }
        Update: {
          id?: string
          name?: string
          price_cents?: number
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
      booking_claim_requests: {
        Row: {
          id: string
          booking_id: string
          client_id: string
          pro_profile_id: string
          claim_type: string
          message: string
          attachment_urls: string[]
          status: string
          issue_number: number
          admin_resolution: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          client_id: string
          pro_profile_id: string
          claim_type: string
          message: string
          attachment_urls?: string[]
          status?: string
          issue_number?: number
          admin_resolution?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          client_id?: string
          pro_profile_id?: string
          claim_type?: string
          message?: string
          attachment_urls?: string[]
          status?: string
          issue_number?: number
          admin_resolution?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_claim_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_claim_requests_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          id: string
          booking_id: string | null
          pro_profile_id: string
          client_id: string | null
          amount_cents: number
          currency: string
          square_payment_id: string | null
          status: string
          idempotency_key: string
          card_brand: string | null
          card_last_4: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id?: string | null
          pro_profile_id: string
          client_id?: string | null
          amount_cents: number
          currency?: string
          square_payment_id?: string | null
          status?: string
          idempotency_key: string
          card_brand?: string | null
          card_last_4?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string | null
          pro_profile_id?: string
          client_id?: string | null
          amount_cents?: number
          currency?: string
          square_payment_id?: string | null
          status?: string
          idempotency_key?: string
          card_brand?: string | null
          card_last_4?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_pro_profile_id_fkey"
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
      calculate_proration: {
        Args: {
          billing_start: string
          cycle_days: number
          new_price_cents: number
          old_price_cents: number
        }
        Returns: number
      }
      get_pro_avg_rating: {
        Args: { p_pro_profile_id: string }
        Returns: {
          avg_rating: number
          review_count: number
        }[]
      }
      get_top_services_by_browse: {
        Args: { p_limit?: number }
        Returns: {
          category_slug: string
          service_slug: string
          browse_count: number
        }[]
      }
      increment_service_browse_stats: {
        Args: { p_category_slug: string; p_service_slug: string }
        Returns: undefined
      }
      grant_platform_admin_by_email: {
        Args: { p_email: string; p_grant: boolean }
        Returns: undefined
      }
      list_platform_admin_accounts: {
        Args: Record<string, never>
        Returns: {
          user_id: string
          email: string
          full_name: string
          is_platform_admin: boolean
          is_supreme: boolean
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
