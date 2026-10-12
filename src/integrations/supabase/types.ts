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
      account_contact_challenges: {
        Row: {
          attempts: number
          channel: string
          code_hash: string | null
          consumed_at: string | null
          created_at: string
          destination: string
          expires_at: string
          id: string
          purpose: string
          user_id: string
        }
        Insert: {
          attempts?: number
          channel: string
          code_hash?: string | null
          consumed_at?: string | null
          created_at?: string
          destination: string
          expires_at: string
          id?: string
          purpose: string
          user_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          code_hash?: string | null
          consumed_at?: string | null
          created_at?: string
          destination?: string
          expires_at?: string
          id?: string
          purpose?: string
          user_id?: string
        }
        Relationships: []
      }
      account_contact_grants: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          new_value: string | null
          purpose: string
          user_id: string
          uses_left: number
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          new_value?: string | null
          purpose: string
          user_id: string
          uses_left?: number
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          new_value?: string | null
          purpose?: string
          user_id?: string
          uses_left?: number
        }
        Relationships: []
      }
      account_deletion_requests: {
        Row: {
          admin_notes: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string
          id: string
          processed_at: string | null
          reason: string | null
          requested_at: string
          retain_audit: boolean
          retain_financial: boolean
          scheduled_delete_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          processed_at?: string | null
          reason?: string | null
          requested_at?: string
          retain_audit?: boolean
          retain_financial?: boolean
          scheduled_delete_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          processed_at?: string | null
          reason?: string | null
          requested_at?: string
          retain_audit?: boolean
          retain_financial?: boolean
          scheduled_delete_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_actions: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          details: Json | null
          id: string
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
        }
        Relationships: []
      }
      apple_pay_handoffs: {
        Row: {
          booking_id: string | null
          client_id: string
          created_at: string
          draft: Json
          expires_at: string
          id: string
          idempotency_key: string | null
          paid_at: string | null
          payment_method_label: string | null
          square_payment_id: string | null
          status: string
        }
        Insert: {
          booking_id?: string | null
          client_id: string
          created_at?: string
          draft: Json
          expires_at?: string
          id?: string
          idempotency_key?: string | null
          paid_at?: string | null
          payment_method_label?: string | null
          square_payment_id?: string | null
          status?: string
        }
        Update: {
          booking_id?: string | null
          client_id?: string
          created_at?: string
          draft?: Json
          expires_at?: string
          id?: string
          idempotency_key?: string | null
          paid_at?: string | null
          payment_method_label?: string | null
          square_payment_id?: string | null
          status?: string
        }
        Relationships: []
      }
      booking_assistant_messages: {
        Row: {
          booking_id: string
          content: string
          created_at: string
          id: string
          sender_role: string
          sender_user_id: string | null
        }
        Insert: {
          booking_id: string
          content: string
          created_at?: string
          id?: string
          sender_role: string
          sender_user_id?: string | null
        }
        Update: {
          booking_id?: string
          content?: string
          created_at?: string
          id?: string
          sender_role?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_assistant_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_claim_requests: {
        Row: {
          admin_resolution: string | null
          attachment_urls: string[]
          booking_id: string
          claim_type: string
          client_id: string
          created_at: string
          dispute_category: string | null
          id: string
          investigation_notes: string | null
          issue_category: string | null
          issue_number: number
          message: string
          policy_version: string | null
          pro_profile_id: string
          refund_amount_cents: number | null
          reperformance_status: string | null
          replacement_status: string | null
          resolution_summary: string | null
          status: string
          workflow_status: string | null
        }
        Insert: {
          admin_resolution?: string | null
          attachment_urls?: string[]
          booking_id: string
          claim_type: string
          client_id: string
          created_at?: string
          dispute_category?: string | null
          id?: string
          investigation_notes?: string | null
          issue_category?: string | null
          issue_number?: number
          message: string
          policy_version?: string | null
          pro_profile_id: string
          refund_amount_cents?: number | null
          reperformance_status?: string | null
          replacement_status?: string | null
          resolution_summary?: string | null
          status?: string
          workflow_status?: string | null
        }
        Update: {
          admin_resolution?: string | null
          attachment_urls?: string[]
          booking_id?: string
          claim_type?: string
          client_id?: string
          created_at?: string
          dispute_category?: string | null
          id?: string
          investigation_notes?: string | null
          issue_category?: string | null
          issue_number?: number
          message?: string
          policy_version?: string | null
          pro_profile_id?: string
          refund_amount_cents?: number | null
          reperformance_status?: string | null
          replacement_status?: string | null
          resolution_summary?: string | null
          status?: string
          workflow_status?: string | null
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
      booking_credit_allocations: {
        Row: {
          created_at: string
          credit_amount: number
          grant_id: string
          id: string
          reservation_id: string
        }
        Insert: {
          created_at?: string
          credit_amount: number
          grant_id: string
          id?: string
          reservation_id: string
        }
        Update: {
          created_at?: string
          credit_amount?: number
          grant_id?: string
          id?: string
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_credit_allocations_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "booking_credit_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_credit_allocations_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "booking_credit_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_credit_config: {
        Row: {
          coverage_cents: number
          id: boolean
          monthly_expiry_days: number
          refill_price_cents_per_credit: number | null
          updated_at: string
        }
        Insert: {
          coverage_cents?: number
          id?: boolean
          monthly_expiry_days?: number
          refill_price_cents_per_credit?: number | null
          updated_at?: string
        }
        Update: {
          coverage_cents?: number
          id?: boolean
          monthly_expiry_days?: number
          refill_price_cents_per_credit?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      booking_credit_grants: {
        Row: {
          created_at: string
          expires_at: string | null
          grant_type: string
          granted: number
          id: string
          metadata: Json
          pro_profile_id: string
          remaining: number
          source_reference: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          grant_type: string
          granted: number
          id?: string
          metadata?: Json
          pro_profile_id: string
          remaining: number
          source_reference?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          grant_type?: string
          granted?: number
          id?: string
          metadata?: Json
          pro_profile_id?: string
          remaining?: number
          source_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_credit_grants_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_credit_ledger: {
        Row: {
          booking_id: string | null
          created_at: string
          credit_amount: number
          grant_id: string | null
          id: string
          metadata: Json
          pro_profile_id: string
          reason: string | null
          source_reference: string | null
          transaction_type: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          credit_amount: number
          grant_id?: string | null
          id?: string
          metadata?: Json
          pro_profile_id: string
          reason?: string | null
          source_reference?: string | null
          transaction_type: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          credit_amount?: number
          grant_id?: string | null
          id?: string
          metadata?: Json
          pro_profile_id?: string
          reason?: string | null
          source_reference?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_credit_ledger_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_credit_ledger_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "booking_credit_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_credit_ledger_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_credit_promotions: {
        Row: {
          combinable: boolean
          credit_amount: number
          credit_expires_days: number | null
          eligibility: Json
          enabled: boolean
          ends_at: string | null
          id: string
          name: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          combinable?: boolean
          credit_amount: number
          credit_expires_days?: number | null
          eligibility?: Json
          enabled?: boolean
          ends_at?: string | null
          id?: string
          name: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          combinable?: boolean
          credit_amount?: number
          credit_expires_days?: number | null
          eligibility?: Json
          enabled?: boolean
          ends_at?: string | null
          id?: string
          name?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      booking_credit_reservations: {
        Row: {
          booking_id: string
          created_at: string
          credits_reserved: number
          eligible_value_cents: number
          id: string
          pro_profile_id: string
          status: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          credits_reserved: number
          eligible_value_cents: number
          id?: string
          pro_profile_id: string
          status: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          credits_reserved?: number
          eligible_value_cents?: number
          id?: string
          pro_profile_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_credit_reservations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_credit_reservations_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_series: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          frequency: string
          id: string
          last_booking_id: string | null
          last_generated_at: string | null
          last_skip_reason: string | null
          next_date: string
          preferred_time: string | null
          pro_profile_id: string
          proposed_by: string
          service_category_slug: string | null
          service_duration_minutes: number | null
          service_location_choice: string | null
          service_slug: string | null
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          template_booking_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          frequency: string
          id?: string
          last_booking_id?: string | null
          last_generated_at?: string | null
          last_skip_reason?: string | null
          next_date: string
          preferred_time?: string | null
          pro_profile_id: string
          proposed_by: string
          service_category_slug?: string | null
          service_duration_minutes?: number | null
          service_location_choice?: string | null
          service_slug?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          template_booking_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          frequency?: string
          id?: string
          last_booking_id?: string | null
          last_generated_at?: string | null
          last_skip_reason?: string | null
          next_date?: string
          preferred_time?: string | null
          pro_profile_id?: string
          proposed_by?: string
          service_category_slug?: string | null
          service_duration_minutes?: number | null
          service_location_choice?: string | null
          service_slug?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          template_booking_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_series_last_booking_id_fkey"
            columns: ["last_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_series_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_series_template_booking_id_fkey"
            columns: ["template_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          auto_reply_snapshot: string | null
          booking_terms_version: string | null
          cancel_fee_cents_snapshot: number | null
          cancel_fee_percent_snapshot: number | null
          cancel_fee_type_snapshot: string | null
          cancel_policy_acknowledged_at: string | null
          cancel_policy_snapshot: string | null
          client_id: string
          client_renews_annually: boolean
          client_unread: boolean
          created_at: string
          decline_reason: string | null
          distance_km_snapshot: number | null
          drive_minutes_snapshot: number | null
          id: string
          invoice_number: number | null
          invoice_snapshot: Json | null
          is_test: boolean
          preferred_date: string | null
          preferred_time: string | null
          pro_profile_id: string
          pro_unread: boolean
          public_booking_code: string
          renewal_anchor_date: string | null
          renewal_interval_months_snapshot: number | null
          responded_at: string | null
          series_id: string | null
          service_category_slug: string | null
          service_duration_minutes: number | null
          service_location_choice: string | null
          service_slug: string | null
          sms_confirmation_sent_at: string | null
          sms_reminder_sent_at: string | null
          sms_request_sent_at: string | null
          sms_review_request_sent_at: string | null
          status: string
          terms_acceptance_method: string | null
          terms_accepted_at: string | null
          terms_hash: string | null
        }
        Insert: {
          auto_reply_snapshot?: string | null
          booking_terms_version?: string | null
          cancel_fee_cents_snapshot?: number | null
          cancel_fee_percent_snapshot?: number | null
          cancel_fee_type_snapshot?: string | null
          cancel_policy_acknowledged_at?: string | null
          cancel_policy_snapshot?: string | null
          client_id: string
          client_renews_annually?: boolean
          client_unread?: boolean
          created_at?: string
          decline_reason?: string | null
          distance_km_snapshot?: number | null
          drive_minutes_snapshot?: number | null
          id?: string
          invoice_number?: number | null
          invoice_snapshot?: Json | null
          is_test?: boolean
          preferred_date?: string | null
          preferred_time?: string | null
          pro_profile_id: string
          pro_unread?: boolean
          public_booking_code: string
          renewal_anchor_date?: string | null
          renewal_interval_months_snapshot?: number | null
          responded_at?: string | null
          series_id?: string | null
          service_category_slug?: string | null
          service_duration_minutes?: number | null
          service_location_choice?: string | null
          service_slug?: string | null
          sms_confirmation_sent_at?: string | null
          sms_reminder_sent_at?: string | null
          sms_request_sent_at?: string | null
          sms_review_request_sent_at?: string | null
          status?: string
          terms_acceptance_method?: string | null
          terms_accepted_at?: string | null
          terms_hash?: string | null
        }
        Update: {
          auto_reply_snapshot?: string | null
          booking_terms_version?: string | null
          cancel_fee_cents_snapshot?: number | null
          cancel_fee_percent_snapshot?: number | null
          cancel_fee_type_snapshot?: string | null
          cancel_policy_acknowledged_at?: string | null
          cancel_policy_snapshot?: string | null
          client_id?: string
          client_renews_annually?: boolean
          client_unread?: boolean
          created_at?: string
          decline_reason?: string | null
          distance_km_snapshot?: number | null
          drive_minutes_snapshot?: number | null
          id?: string
          invoice_number?: number | null
          invoice_snapshot?: Json | null
          is_test?: boolean
          preferred_date?: string | null
          preferred_time?: string | null
          pro_profile_id?: string
          pro_unread?: boolean
          public_booking_code?: string
          renewal_anchor_date?: string | null
          renewal_interval_months_snapshot?: number | null
          responded_at?: string | null
          series_id?: string | null
          service_category_slug?: string | null
          service_duration_minutes?: number | null
          service_location_choice?: string | null
          service_slug?: string | null
          sms_confirmation_sent_at?: string | null
          sms_reminder_sent_at?: string | null
          sms_request_sent_at?: string | null
          sms_review_request_sent_at?: string | null
          status?: string
          terms_acceptance_method?: string | null
          terms_accepted_at?: string | null
          terms_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "booking_series"
            referencedColumns: ["id"]
          },
        ]
      }
      client_review_submission_locks: {
        Row: {
          client_id: string
          locked_at: string
          pro_profile_id: string
        }
        Insert: {
          client_id: string
          locked_at?: string
          pro_profile_id: string
        }
        Update: {
          client_id?: string
          locked_at?: string
          pro_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_review_submission_locks_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reviews: {
        Row: {
          booking_id: string | null
          client_id: string
          content: string | null
          created_at: string
          id: string
          photo_urls: string[]
          pro_profile_id: string
          rating: number
        }
        Insert: {
          booking_id?: string | null
          client_id: string
          content?: string | null
          created_at?: string
          id?: string
          photo_urls?: string[]
          pro_profile_id: string
          rating: number
        }
        Update: {
          booking_id?: string | null
          client_id?: string
          content?: string | null
          created_at?: string
          id?: string
          photo_urls?: string[]
          pro_profile_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reviews_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
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
      front_desk_demo_slots: {
        Row: {
          booking_label: string | null
          created_at: string
          duration_minutes: number
          id: string
          service_slug: string
          slot_date: string
          slot_time: string
          status: string
        }
        Insert: {
          booking_label?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          service_slug?: string
          slot_date: string
          slot_time: string
          status?: string
        }
        Update: {
          booking_label?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          service_slug?: string
          slot_date?: string
          slot_time?: string
          status?: string
        }
        Relationships: []
      }
      front_desk_sessions: {
        Row: {
          active_booking_id: string | null
          authenticated: boolean
          call_control_id: string | null
          channel: string
          closed_at: string | null
          created_at: string
          customer_member_id: string | null
          customer_user_id: string | null
          draft: Json
          flow: string | null
          id: string
          language: string
          openai_call_id: string | null
          otp_sent_at: string | null
          otp_verified_at: string | null
          updated_at: string
        }
        Insert: {
          active_booking_id?: string | null
          authenticated?: boolean
          call_control_id?: string | null
          channel: string
          closed_at?: string | null
          created_at?: string
          customer_member_id?: string | null
          customer_user_id?: string | null
          draft?: Json
          flow?: string | null
          id?: string
          language?: string
          openai_call_id?: string | null
          otp_sent_at?: string | null
          otp_verified_at?: string | null
          updated_at?: string
        }
        Update: {
          active_booking_id?: string | null
          authenticated?: boolean
          call_control_id?: string | null
          channel?: string
          closed_at?: string | null
          created_at?: string
          customer_member_id?: string | null
          customer_user_id?: string | null
          draft?: Json
          flow?: string | null
          id?: string
          language?: string
          openai_call_id?: string | null
          otp_sent_at?: string | null
          otp_verified_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "front_desk_sessions_active_booking_id_fkey"
            columns: ["active_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      front_desk_tickets: {
        Row: {
          body: string
          booking_id: string | null
          created_at: string
          customer_user_id: string | null
          id: string
          kind: string
          session_id: string | null
          status: string
          subject: string | null
        }
        Insert: {
          body: string
          booking_id?: string | null
          created_at?: string
          customer_user_id?: string | null
          id?: string
          kind: string
          session_id?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          body?: string
          booking_id?: string | null
          created_at?: string
          customer_user_id?: string | null
          id?: string
          kind?: string
          session_id?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "front_desk_tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "front_desk_tickets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "front_desk_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      geocode_cache: {
        Row: {
          city: string | null
          formatted_address: string | null
          lat: number
          lng: number
          postal: string
          province: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          formatted_address?: string | null
          lat: number
          lng: number
          postal: string
          province?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          formatted_address?: string | null
          lat?: number
          lng?: number
          postal?: string
          province?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      job_quotes: {
        Row: {
          created_at: string
          estimated_time: string | null
          id: string
          job_request_id: string
          message: string | null
          price_cents: number | null
          pro_profile_id: string
          proposed_service_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estimated_time?: string | null
          id?: string
          job_request_id: string
          message?: string | null
          price_cents?: number | null
          pro_profile_id: string
          proposed_service_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estimated_time?: string | null
          id?: string
          job_request_id?: string
          message?: string | null
          price_cents?: number | null
          pro_profile_id?: string
          proposed_service_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_quotes_job_request_id_fkey"
            columns: ["job_request_id"]
            isOneToOne: false
            referencedRelation: "job_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_quotes_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_request_moderation_notices: {
        Row: {
          body: string
          created_at: string
          id: string
          job_request_id: string | null
          read_at: string | null
          reason: string
          rules_reminder: string | null
          strike_count: number | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          job_request_id?: string | null
          read_at?: string | null
          reason: string
          rules_reminder?: string | null
          strike_count?: number | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          job_request_id?: string | null
          read_at?: string | null
          reason?: string
          rules_reminder?: string | null
          strike_count?: number | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_request_moderation_notices_job_request_id_fkey"
            columns: ["job_request_id"]
            isOneToOne: false
            referencedRelation: "job_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_request_moderation_notices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "job_request_moderation_notices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      job_requests: {
        Row: {
          ai_category: string | null
          budget_range: string | null
          category: string
          category_slug: string | null
          city: string | null
          client_id: string
          created_at: string
          description: string
          exact_time: string | null
          id: string
          latitude: number | null
          longitude: number | null
          moderation_reason: string | null
          moderation_removed_at: string | null
          moderation_removed_by: string | null
          photo_urls: string[] | null
          postal_code: string | null
          preferred_date: string | null
          preferred_time_window: string | null
          province: string | null
          range_end_date: string | null
          range_start_date: string | null
          scheduling_mode: string | null
          service_slug: string | null
          status: string
          time_window_code: string | null
          timing: string | null
          updated_at: string
          window_time_end: string | null
          window_time_start: string | null
        }
        Insert: {
          ai_category?: string | null
          budget_range?: string | null
          category: string
          category_slug?: string | null
          city?: string | null
          client_id: string
          created_at?: string
          description: string
          exact_time?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          moderation_reason?: string | null
          moderation_removed_at?: string | null
          moderation_removed_by?: string | null
          photo_urls?: string[] | null
          postal_code?: string | null
          preferred_date?: string | null
          preferred_time_window?: string | null
          province?: string | null
          range_end_date?: string | null
          range_start_date?: string | null
          scheduling_mode?: string | null
          service_slug?: string | null
          status?: string
          time_window_code?: string | null
          timing?: string | null
          updated_at?: string
          window_time_end?: string | null
          window_time_start?: string | null
        }
        Update: {
          ai_category?: string | null
          budget_range?: string | null
          category?: string
          category_slug?: string | null
          city?: string | null
          client_id?: string
          created_at?: string
          description?: string
          exact_time?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          moderation_reason?: string | null
          moderation_removed_at?: string | null
          moderation_removed_by?: string | null
          photo_urls?: string[] | null
          postal_code?: string | null
          preferred_date?: string | null
          preferred_time_window?: string | null
          province?: string | null
          range_end_date?: string | null
          range_start_date?: string | null
          scheduling_mode?: string | null
          service_slug?: string | null
          status?: string
          time_window_code?: string | null
          timing?: string | null
          updated_at?: string
          window_time_end?: string | null
          window_time_start?: string | null
        }
        Relationships: []
      }
      legal_document_acceptances: {
        Row: {
          accepted_at: string
          booking_id: string | null
          context: string | null
          created_at: string
          document_hash: string
          document_type: string
          document_version: string
          id: string
          language_displayed: string
          language_selected: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          booking_id?: string | null
          context?: string | null
          created_at?: string
          document_hash: string
          document_type: string
          document_version: string
          id?: string
          language_displayed: string
          language_selected: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          booking_id?: string | null
          context?: string | null
          created_at?: string
          document_hash?: string
          document_type?: string
          document_version?: string
          id?: string
          language_displayed?: string
          language_selected?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_document_acceptances_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string
          id: number
          identifier_hash: string
          ip_hash: string
          success: boolean
        }
        Insert: {
          attempted_at?: string
          id?: never
          identifier_hash: string
          ip_hash: string
          success?: boolean
        }
        Update: {
          attempted_at?: string
          id?: never
          identifier_hash?: string
          ip_hash?: string
          success?: boolean
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          booking_id: string | null
          card_brand: string | null
          card_last_4: string | null
          client_id: string | null
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          is_test: boolean
          pro_profile_id: string
          square_payment_id: string | null
          status: string
        }
        Insert: {
          amount_cents: number
          booking_id?: string | null
          card_brand?: string | null
          card_last_4?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key: string
          is_test?: boolean
          pro_profile_id: string
          square_payment_id?: string | null
          status?: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string | null
          card_brand?: string | null
          card_last_4?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          is_test?: boolean
          pro_profile_id?: string
          square_payment_id?: string | null
          status?: string
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
      plans: {
        Row: {
          id: string
          name: string | null
          price_cents: number | null
        }
        Insert: {
          id: string
          name?: string | null
          price_cents?: number | null
        }
        Update: {
          id?: string
          name?: string | null
          price_cents?: number | null
        }
        Relationships: []
      }
      platform_admin_audit_events: {
        Row: {
          action: string
          actor_member_id: string | null
          actor_user_id: string | null
          created_at: string
          detail: Json
          id: string
          target_member_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_member_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          target_member_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_member_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          target_member_id?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      platform_admin_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      platform_admin_staff: {
        Row: {
          additional_info: string
          address: string
          best_contact_method: string
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          email: string
          full_name: string
          member_id: string
          phone: string
          phone_secondary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_info?: string
          address?: string
          best_contact_method?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string
          full_name?: string
          member_id: string
          phone?: string
          phone_secondary?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_info?: string
          address?: string
          best_contact_method?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string
          full_name?: string
          member_id?: string
          phone?: string
          phone_secondary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_keepalive: {
        Row: {
          id: number
          last_ping_at: string
          ping_count: number
        }
        Insert: {
          id: number
          last_ping_at?: string
          ping_count?: number
        }
        Update: {
          id?: number
          last_ping_at?: string
          ping_count?: number
        }
        Relationships: []
      }
      platform_whats_new_announcements: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          href: string
          id: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          href?: string
          id?: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          href?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      privacy_security_incidents: {
        Row: {
          containment: string | null
          created_at: string
          data_affected: string | null
          date_discovered: string | null
          date_occurred: string | null
          id: string
          incident_code: string | null
          investigation: string | null
          legal_review_required: boolean
          notification_review: string | null
          resolution: string | null
          responsible_person: string | null
          severity: string | null
          status: string
          system_name: string | null
          updated_at: string
          users_affected_estimate: number | null
        }
        Insert: {
          containment?: string | null
          created_at?: string
          data_affected?: string | null
          date_discovered?: string | null
          date_occurred?: string | null
          id?: string
          incident_code?: string | null
          investigation?: string | null
          legal_review_required?: boolean
          notification_review?: string | null
          resolution?: string | null
          responsible_person?: string | null
          severity?: string | null
          status?: string
          system_name?: string | null
          updated_at?: string
          users_affected_estimate?: number | null
        }
        Update: {
          containment?: string | null
          created_at?: string
          data_affected?: string | null
          date_discovered?: string | null
          date_occurred?: string | null
          id?: string
          incident_code?: string | null
          investigation?: string | null
          legal_review_required?: boolean
          notification_review?: string | null
          resolution?: string | null
          responsible_person?: string | null
          severity?: string | null
          status?: string
          system_name?: string | null
          updated_at?: string
          users_affected_estimate?: number | null
        }
        Relationships: []
      }
      pro_client_notes: {
        Row: {
          client_id: string
          created_at: string
          note: string
          pro_profile_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          note?: string
          pro_profile_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          note?: string
          pro_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_client_notes_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      pro_plan_cancellations: {
        Row: {
          created_at: string
          id: string
          previous_plan_id: string
          pro_profile_id: string
          reason_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          previous_plan_id: string
          pro_profile_id: string
          reason_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          previous_plan_id?: string
          pro_profile_id?: string
          reason_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_plan_cancellations_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_profile_views: {
        Row: {
          created_at: string
          id: string
          pro_profile_id: string
          viewer_hash: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          pro_profile_id: string
          viewer_hash?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          pro_profile_id?: string
          viewer_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pro_profile_views_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_profiles: {
        Row: {
          application_declined_at: string | null
          approval_baseline_json: Json | null
          availability: string | null
          available_date_overrides: Json | null
          banner_image_url: string | null
          bio: string | null
          booking_cancel_fee_percent: number
          booking_cancel_policy: string
          business_address: string | null
          business_name: string
          cancel_return_discount_consumed_at: string | null
          cancel_return_discount_pending: boolean
          created_at: string
          email_language: string | null
          gst_registration_number: string | null
          id: string
          id_document_url: string | null
          is_verified: boolean | null
          latitude: number | null
          latitude_approx: number | null
          legal_business_name: string | null
          location: string | null
          location_city: string | null
          longitude: number | null
          longitude_approx: number | null
          offers_travel: boolean | null
          offers_workspace: boolean | null
          page_accent_color: string | null
          page_background_color: string | null
          page_header_text: string | null
          page_primary_color: string | null
          page_secondary_color: string | null
          page_template: string | null
          personal_photo_url: string | null
          phone: string | null
          price_max: number | null
          price_min: number | null
          primary_category_slug: string | null
          pro_accent_color: string | null
          pro_member_id: string | null
          profile_last_edited_at: string | null
          qst_registration_number: string | null
          rebook_reminder_enabled: boolean
          rebook_reminder_weeks: number
          recurring_auto_approve: boolean
          referral_invite_panel_enabled: boolean
          service_at_workspace_only: boolean | null
          service_radius_km: number | null
          service_tags: string[] | null
          share_slug: string | null
          sms_confirmation_message_custom: string | null
          sms_reminder_hours: number
          sms_reminder_message_custom: string | null
          sms_review_request_message_custom: string | null
          square_location_id: string | null
          subscription_tier: string | null
          unavailable_dates: Json | null
          updated_at: string
          user_id: string
          website: string | null
          years_experience: number | null
        }
        Insert: {
          application_declined_at?: string | null
          approval_baseline_json?: Json | null
          availability?: string | null
          available_date_overrides?: Json | null
          banner_image_url?: string | null
          bio?: string | null
          booking_cancel_fee_percent?: number
          booking_cancel_policy?: string
          business_address?: string | null
          business_name: string
          cancel_return_discount_consumed_at?: string | null
          cancel_return_discount_pending?: boolean
          created_at?: string
          email_language?: string | null
          gst_registration_number?: string | null
          id?: string
          id_document_url?: string | null
          is_verified?: boolean | null
          latitude?: number | null
          latitude_approx?: number | null
          legal_business_name?: string | null
          location?: string | null
          location_city?: string | null
          longitude?: number | null
          longitude_approx?: number | null
          offers_travel?: boolean | null
          offers_workspace?: boolean | null
          page_accent_color?: string | null
          page_background_color?: string | null
          page_header_text?: string | null
          page_primary_color?: string | null
          page_secondary_color?: string | null
          page_template?: string | null
          personal_photo_url?: string | null
          phone?: string | null
          price_max?: number | null
          price_min?: number | null
          primary_category_slug?: string | null
          pro_accent_color?: string | null
          pro_member_id?: string | null
          profile_last_edited_at?: string | null
          qst_registration_number?: string | null
          rebook_reminder_enabled?: boolean
          rebook_reminder_weeks?: number
          recurring_auto_approve?: boolean
          referral_invite_panel_enabled?: boolean
          service_at_workspace_only?: boolean | null
          service_radius_km?: number | null
          service_tags?: string[] | null
          share_slug?: string | null
          sms_confirmation_message_custom?: string | null
          sms_reminder_hours?: number
          sms_reminder_message_custom?: string | null
          sms_review_request_message_custom?: string | null
          square_location_id?: string | null
          subscription_tier?: string | null
          unavailable_dates?: Json | null
          updated_at?: string
          user_id: string
          website?: string | null
          years_experience?: number | null
        }
        Update: {
          application_declined_at?: string | null
          approval_baseline_json?: Json | null
          availability?: string | null
          available_date_overrides?: Json | null
          banner_image_url?: string | null
          bio?: string | null
          booking_cancel_fee_percent?: number
          booking_cancel_policy?: string
          business_address?: string | null
          business_name?: string
          cancel_return_discount_consumed_at?: string | null
          cancel_return_discount_pending?: boolean
          created_at?: string
          email_language?: string | null
          gst_registration_number?: string | null
          id?: string
          id_document_url?: string | null
          is_verified?: boolean | null
          latitude?: number | null
          latitude_approx?: number | null
          legal_business_name?: string | null
          location?: string | null
          location_city?: string | null
          longitude?: number | null
          longitude_approx?: number | null
          offers_travel?: boolean | null
          offers_workspace?: boolean | null
          page_accent_color?: string | null
          page_background_color?: string | null
          page_header_text?: string | null
          page_primary_color?: string | null
          page_secondary_color?: string | null
          page_template?: string | null
          personal_photo_url?: string | null
          phone?: string | null
          price_max?: number | null
          price_min?: number | null
          primary_category_slug?: string | null
          pro_accent_color?: string | null
          pro_member_id?: string | null
          profile_last_edited_at?: string | null
          qst_registration_number?: string | null
          rebook_reminder_enabled?: boolean
          rebook_reminder_weeks?: number
          recurring_auto_approve?: boolean
          referral_invite_panel_enabled?: boolean
          service_at_workspace_only?: boolean | null
          service_radius_km?: number | null
          service_tags?: string[] | null
          share_slug?: string | null
          sms_confirmation_message_custom?: string | null
          sms_reminder_hours?: number
          sms_reminder_message_custom?: string | null
          sms_review_request_message_custom?: string | null
          square_location_id?: string | null
          subscription_tier?: string | null
          unavailable_dates?: Json | null
          updated_at?: string
          user_id?: string
          website?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      pro_services: {
        Row: {
          auto_reply_message: string | null
          cancel_fee_cents: number
          cancel_fee_percent: number
          cancel_fee_type: string
          cancel_policy: string
          category_slug: string
          created_at: string
          custom_price_max: number | null
          custom_price_min: number | null
          description: string | null
          display_name: string | null
          duration_minutes: number | null
          id: string
          location_mode: string | null
          pro_profile_id: string
          renewal_interval_months: number | null
          service_slug: string
          workspace_address: string | null
          workspace_latitude: number | null
          workspace_latitude_approx: number | null
          workspace_longitude: number | null
          workspace_longitude_approx: number | null
        }
        Insert: {
          auto_reply_message?: string | null
          cancel_fee_cents?: number
          cancel_fee_percent?: number
          cancel_fee_type?: string
          cancel_policy?: string
          category_slug: string
          created_at?: string
          custom_price_max?: number | null
          custom_price_min?: number | null
          description?: string | null
          display_name?: string | null
          duration_minutes?: number | null
          id?: string
          location_mode?: string | null
          pro_profile_id: string
          renewal_interval_months?: number | null
          service_slug: string
          workspace_address?: string | null
          workspace_latitude?: number | null
          workspace_latitude_approx?: number | null
          workspace_longitude?: number | null
          workspace_longitude_approx?: number | null
        }
        Update: {
          auto_reply_message?: string | null
          cancel_fee_cents?: number
          cancel_fee_percent?: number
          cancel_fee_type?: string
          cancel_policy?: string
          category_slug?: string
          created_at?: string
          custom_price_max?: number | null
          custom_price_min?: number | null
          description?: string | null
          display_name?: string | null
          duration_minutes?: number | null
          id?: string
          location_mode?: string | null
          pro_profile_id?: string
          renewal_interval_months?: number | null
          service_slug?: string
          workspace_address?: string | null
          workspace_latitude?: number | null
          workspace_latitude_approx?: number | null
          workspace_longitude?: number | null
          workspace_longitude_approx?: number | null
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
      pro_subscriptions: {
        Row: {
          billing_cycle_days: number
          billing_start: string
          plan_id: string
          square_card_fingerprint: string | null
          square_card_id: string | null
          square_customer_id: string | null
          square_trial_used: boolean
          trial_ends_at: string | null
          trial_source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle_days?: number
          billing_start?: string
          plan_id: string
          square_card_fingerprint?: string | null
          square_card_id?: string | null
          square_customer_id?: string | null
          square_trial_used?: boolean
          trial_ends_at?: string | null
          trial_source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle_days?: number
          billing_start?: string
          plan_id?: string
          square_card_fingerprint?: string | null
          square_card_id?: string | null
          square_customer_id?: string | null
          square_trial_used?: boolean
          trial_ends_at?: string | null
          trial_source?: string | null
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
      pro_verification_documents: {
        Row: {
          created_at: string
          document_type: string
          extracted_fields: Json
          id: string
          pro_profile_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_type: string
          extracted_fields?: Json
          id?: string
          pro_profile_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          extracted_fields?: Json
          id?: string
          pro_profile_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_verification_documents_pro_profile_id_fkey"
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
          booking_id_verification_status: string | null
          created_at: string
          email_language: string | null
          full_name: string | null
          id: string
          is_platform_admin: boolean
          is_test_account: boolean
          job_request_strikes: number
          job_requests_blocked_at: string | null
          phone: string | null
          postal_code: string | null
          public_user_number: string
          rebook_reminders_opt_out: boolean
          updated_at: string
          user_id: string
          username: string | null
          voice_pin_failed_attempts: number
          voice_pin_hash: string | null
          voice_pin_locked_until: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          birthday?: string | null
          booking_id_verification_photo_path?: string | null
          booking_id_verification_status?: string | null
          created_at?: string
          email_language?: string | null
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean
          is_test_account?: boolean
          job_request_strikes?: number
          job_requests_blocked_at?: string | null
          phone?: string | null
          postal_code?: string | null
          public_user_number: string
          rebook_reminders_opt_out?: boolean
          updated_at?: string
          user_id: string
          username?: string | null
          voice_pin_failed_attempts?: number
          voice_pin_hash?: string | null
          voice_pin_locked_until?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          birthday?: string | null
          booking_id_verification_photo_path?: string | null
          booking_id_verification_status?: string | null
          created_at?: string
          email_language?: string | null
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean
          is_test_account?: boolean
          job_request_strikes?: number
          job_requests_blocked_at?: string | null
          phone?: string | null
          postal_code?: string | null
          public_user_number?: string
          rebook_reminders_opt_out?: boolean
          updated_at?: string
          user_id?: string
          username?: string | null
          voice_pin_failed_attempts?: number
          voice_pin_hash?: string | null
          voice_pin_locked_until?: string | null
        }
        Relationships: []
      }
      rebook_nudges: {
        Row: {
          anchor_booking_id: string
          attempts: number
          channel: string
          client_id: string
          created_at: string
          due_date: string | null
          error: string | null
          id: string
          pro_profile_id: string
          status: string
          unsubscribe_token: string
          updated_at: string
        }
        Insert: {
          anchor_booking_id: string
          attempts?: number
          channel: string
          client_id: string
          created_at?: string
          due_date?: string | null
          error?: string | null
          id?: string
          pro_profile_id: string
          status?: string
          unsubscribe_token?: string
          updated_at?: string
        }
        Update: {
          anchor_booking_id?: string
          attempts?: number
          channel?: string
          client_id?: string
          created_at?: string
          due_date?: string | null
          error?: string | null
          id?: string
          pro_profile_id?: string
          status?: string
          unsubscribe_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rebook_nudges_anchor_booking_id_fkey"
            columns: ["anchor_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rebook_nudges_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_invites: {
        Row: {
          accepted_at: string | null
          claimed_at: string | null
          created_at: string
          id: string
          invited_user_id: string | null
          invitee_email: string
          inviter_user_id: string
          referral_code: string
          reward_code: string | null
          reward_days: number
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          invited_user_id?: string | null
          invitee_email: string
          inviter_user_id: string
          referral_code: string
          reward_code?: string | null
          reward_days?: number
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          invited_user_id?: string | null
          invitee_email?: string
          inviter_user_id?: string
          referral_code?: string
          reward_code?: string | null
          reward_days?: number
          status?: string
          updated_at?: string
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
      review_submission_locks: {
        Row: {
          locked_at: string
          pro_profile_id: string
          reviewer_id: string
        }
        Insert: {
          locked_at?: string
          pro_profile_id: string
          reviewer_id: string
        }
        Update: {
          locked_at?: string
          pro_profile_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_submission_locks_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
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
      service_bundle_items: {
        Row: {
          bundle_id: string
          category_slug: string
          service_slug: string
        }
        Insert: {
          bundle_id: string
          category_slug: string
          service_slug: string
        }
        Update: {
          bundle_id?: string
          category_slug?: string
          service_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "service_bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_bundles: {
        Row: {
          created_at: string
          id: string
          name: string
          pro_profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          pro_profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          pro_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_bundles_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          embedding: string | null
          id: string
          name_en: string | null
          name_fr: string | null
        }
        Insert: {
          embedding?: string | null
          id?: string
          name_en?: string | null
          name_fr?: string | null
        }
        Update: {
          embedding?: string | null
          id?: string
          name_en?: string | null
          name_fr?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          id: string
          monthly_booking_credits: number
          name: string
          price_cents: number
        }
        Insert: {
          id: string
          monthly_booking_credits?: number
          name: string
          price_cents: number
        }
        Update: {
          id?: string
          monthly_booking_credits?: number
          name?: string
          price_cents?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle_days: number | null
          billing_start: string | null
          plan_id: string | null
          user_id: string
        }
        Insert: {
          billing_cycle_days?: number | null
          billing_start?: string | null
          plan_id?: string | null
          user_id: string
        }
        Update: {
          billing_cycle_days?: number | null
          billing_start?: string | null
          plan_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_attempts: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          source: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      trial_grants: {
        Row: {
          created_at: string
          duration_days: number
          id: string
          plan_id: string
          pro_profile_id: string | null
          signup_ip: string | null
          source: string
          square_card_fingerprint: string | null
          square_card_id: string
          square_customer_id: string
          status: string
          token_id: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_days: number
          id?: string
          plan_id?: string
          pro_profile_id?: string | null
          signup_ip?: string | null
          source: string
          square_card_fingerprint?: string | null
          square_card_id: string
          square_customer_id: string
          status?: string
          token_id?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_days?: number
          id?: string
          plan_id?: string
          pro_profile_id?: string | null
          signup_ip?: string | null
          source?: string
          square_card_fingerprint?: string | null
          square_card_id?: string
          square_customer_id?: string
          status?: string
          token_id?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_grants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_grants_pro_profile_id_fkey"
            columns: ["pro_profile_id"]
            isOneToOne: false
            referencedRelation: "pro_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_grants_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "trial_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_tokens: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          duration_days: number
          expires_at: string | null
          id: string
          source: string
          token_hash: string
          token_value: string | null
          used_at: string | null
          used_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          duration_days?: number
          expires_at?: string | null
          id?: string
          source?: string
          token_hash: string
          token_value?: string | null
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          duration_days?: number
          expires_at?: string | null
          id?: string
          source?: string
          token_hash?: string
          token_value?: string | null
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Relationships: []
      }
      username_history: {
        Row: {
          changed_at: string
          id: number
          old_username: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          id?: never
          old_username: string
          user_id: string
        }
        Update: {
          changed_at?: string
          id?: never
          old_username?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          public_user_number: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          public_user_number?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          public_user_number?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_pro_by_admin: { Args: { p_user_id: string }; Returns: undefined }
      account_phone_digits: { Args: { p_phone: string }; Returns: string }
      acknowledge_client_booking: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      acknowledge_client_booking_notifications: {
        Args: never
        Returns: undefined
      }
      acknowledge_pro_booking_notifications: { Args: never; Returns: undefined }
      admin_client_account_summaries: {
        Args: { p_user_ids: string[] }
        Returns: {
          address: string
          birthday: string
          email: string
          email_language: string
          full_name: string
          phone: string
          postal_code: string
          public_user_number: string
          user_id: string
        }[]
      }
      admin_get_pro_profiles: {
        Args: { p_ids?: string[] }
        Returns: {
          application_declined_at: string | null
          approval_baseline_json: Json | null
          availability: string | null
          available_date_overrides: Json | null
          banner_image_url: string | null
          bio: string | null
          booking_cancel_fee_percent: number
          booking_cancel_policy: string
          business_address: string | null
          business_name: string
          cancel_return_discount_consumed_at: string | null
          cancel_return_discount_pending: boolean
          created_at: string
          email_language: string | null
          gst_registration_number: string | null
          id: string
          id_document_url: string | null
          is_verified: boolean | null
          latitude: number | null
          latitude_approx: number | null
          legal_business_name: string | null
          location: string | null
          location_city: string | null
          longitude: number | null
          longitude_approx: number | null
          offers_travel: boolean | null
          offers_workspace: boolean | null
          page_accent_color: string | null
          page_background_color: string | null
          page_header_text: string | null
          page_primary_color: string | null
          page_secondary_color: string | null
          page_template: string | null
          personal_photo_url: string | null
          phone: string | null
          price_max: number | null
          price_min: number | null
          primary_category_slug: string | null
          pro_accent_color: string | null
          pro_member_id: string | null
          profile_last_edited_at: string | null
          qst_registration_number: string | null
          rebook_reminder_enabled: boolean
          rebook_reminder_weeks: number
          recurring_auto_approve: boolean
          referral_invite_panel_enabled: boolean
          service_at_workspace_only: boolean | null
          service_radius_km: number | null
          service_tags: string[] | null
          share_slug: string | null
          sms_confirmation_message_custom: string | null
          sms_reminder_hours: number
          sms_reminder_message_custom: string | null
          sms_review_request_message_custom: string | null
          square_location_id: string | null
          subscription_tier: string | null
          unavailable_dates: Json | null
          updated_at: string
          user_id: string
          website: string | null
          years_experience: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "pro_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_set_pro_subscription_tier: {
        Args: { p_pro_profile_id: string; p_tier: string }
        Returns: undefined
      }
      allocate_pro_member_id: { Args: never; Returns: string }
      allocate_public_user_number: { Args: never; Returns: string }
      auth_can_view_profile_as_counterparty: {
        Args: { p_profile_user_id: string }
        Returns: boolean
      }
      auth_email_taken: {
        Args: { p_email: string; p_except: string }
        Returns: boolean
      }
      auth_is_platform_moderator: { Args: never; Returns: boolean }
      auth_is_super_admin: { Args: never; Returns: boolean }
      auth_owns_pro_with_client: {
        Args: { p_client_id: string; p_pro_profile_id: string }
        Returns: boolean
      }
      auth_uid_is_platform_admin: { Args: never; Returns: boolean }
      booking_series_create: {
        Args: {
          p_first_date: string
          p_frequency: string
          p_template_booking_id: string
        }
        Returns: string
      }
      booking_series_generate_due: {
        Args: { p_dry_run?: boolean; p_horizon_days?: number }
        Returns: Json
      }
      booking_series_step: {
        Args: { p_date: string; p_frequency: string }
        Returns: string
      }
      booking_series_update: {
        Args: { p_action: string; p_series_id: string }
        Returns: string
      }
      calculate_proration:
        | {
            Args: {
              billing_start: string
              cycle_days: number
              new_price: number
              old_price: number
            }
            Returns: number
          }
        | {
            Args: {
              billing_start: string
              cycle_days: number
              new_price_cents: number
              old_price_cents: number
            }
            Returns: number
          }
      change_my_pro_member_id: { Args: { new_number: string }; Returns: Json }
      change_my_public_user_number: {
        Args: { new_number: string }
        Returns: Json
      }
      city_level_location: { Args: { p_location: string }; Returns: string }
      cleanup_trial_tokens: { Args: never; Returns: number }
      clear_my_voice_pin: { Args: never; Returns: Json }
      distance_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      front_desk_find_user_by_phone: {
        Args: { p_phone: string }
        Returns: {
          full_name: string
          has_pin: boolean
          phone: string
          public_user_number: string
          user_id: string
        }[]
      }
      generate_public_booking_code: { Args: never; Returns: string }
      get_email_for_name: { Args: { full_name: string }; Returns: string }
      get_my_pro_profile: {
        Args: never
        Returns: {
          application_declined_at: string | null
          approval_baseline_json: Json | null
          availability: string | null
          available_date_overrides: Json | null
          banner_image_url: string | null
          bio: string | null
          booking_cancel_fee_percent: number
          booking_cancel_policy: string
          business_address: string | null
          business_name: string
          cancel_return_discount_consumed_at: string | null
          cancel_return_discount_pending: boolean
          created_at: string
          email_language: string | null
          gst_registration_number: string | null
          id: string
          id_document_url: string | null
          is_verified: boolean | null
          latitude: number | null
          latitude_approx: number | null
          legal_business_name: string | null
          location: string | null
          location_city: string | null
          longitude: number | null
          longitude_approx: number | null
          offers_travel: boolean | null
          offers_workspace: boolean | null
          page_accent_color: string | null
          page_background_color: string | null
          page_header_text: string | null
          page_primary_color: string | null
          page_secondary_color: string | null
          page_template: string | null
          personal_photo_url: string | null
          phone: string | null
          price_max: number | null
          price_min: number | null
          primary_category_slug: string | null
          pro_accent_color: string | null
          pro_member_id: string | null
          profile_last_edited_at: string | null
          qst_registration_number: string | null
          rebook_reminder_enabled: boolean
          rebook_reminder_weeks: number
          recurring_auto_approve: boolean
          referral_invite_panel_enabled: boolean
          service_at_workspace_only: boolean | null
          service_radius_km: number | null
          service_tags: string[] | null
          share_slug: string | null
          sms_confirmation_message_custom: string | null
          sms_reminder_hours: number
          sms_reminder_message_custom: string | null
          sms_review_request_message_custom: string | null
          square_location_id: string | null
          subscription_tier: string | null
          unavailable_dates: Json | null
          updated_at: string
          user_id: string
          website: string | null
          years_experience: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "pro_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_pro_and_user: {
        Args: { pro_user_id: string }
        Returns: {
          business_name: string
          email: string
          email_language: string
          user_id: string
        }[]
      }
      get_pro_avg_rating: {
        Args: { p_pro_profile_id: string }
        Returns: {
          avg_rating: number
          review_count: number
        }[]
      }
      get_pro_billing_details: {
        Args: { p_pro_profile_ids: string[] }
        Returns: {
          business_address: string
          gst_registration_number: string
          id: string
          legal_business_name: string
          location: string
          qst_registration_number: string
        }[]
      }
      get_pro_open_slots: {
        Args: { p_from?: string; p_pro_profile_id: string; p_to?: string }
        Returns: {
          end_time: string
          grid_start_min: number
          slot_date: string
          start_time: string
        }[]
      }
      get_pro_rank_in_category: {
        Args: { p_pro_profile_id: string }
        Returns: {
          category_slug: string
          rank: number
          total: number
        }[]
      }
      get_pro_service_workspace: {
        Args: { p_pro_profile_id: string }
        Returns: {
          category_slug: string
          id: string
          service_slug: string
          workspace_address: string
          workspace_latitude: number
          workspace_longitude: number
        }[]
      }
      get_pros_serving_point: {
        Args: { p_lat: number; p_lng: number }
        Returns: {
          business_name: string
          distance_km: number
          location: string
          pro_profile_id: string
          service_radius_km: number
        }[]
      }
      get_public_profile: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          full_name: string
          public_user_number: string
          user_id: string
        }[]
      }
      get_top_picks: {
        Args: { p_category_slug: string }
        Returns: {
          avg_rating: number
          booking_count: number
          business_name: string
          pro_profile_id: string
          review_count: number
        }[]
      }
      get_top_services_by_browse: {
        Args: { p_limit?: number }
        Returns: {
          browse_count: number
          category_slug: string
          service_slug: string
        }[]
      }
      grant_booking_credits: {
        Args: {
          p_amount: number
          p_expires_at?: string
          p_grant_type: string
          p_metadata?: Json
          p_pro_profile_id: string
          p_reason?: string
          p_source_reference: string
        }
        Returns: string
      }
      grant_platform_admin_by_email: {
        Args: { p_email: string; p_grant: boolean }
        Returns: undefined
      }
      hash_voice_pin: { Args: { p_pin: string }; Returns: string }
      hhmm_to_minutes: { Args: { p: string }; Returns: number }
      increment_service_browse_stats: {
        Args: { p_category_slug: string; p_service_slug: string }
        Returns: undefined
      }
      internal_check_cron_secret: {
        Args: { p_secret: string }
        Returns: boolean
      }
      internal_square_sandbox_config: { Args: never; Returns: Json }
      is_name_taken: { Args: { full_name: string }; Returns: boolean }
      is_name_taken_by_other: {
        Args: { exclude_email: string; full_name: string }
        Returns: boolean
      }
      is_privileged_db_caller: { Args: never; Returns: boolean }
      is_pro_member_id_available: {
        Args: { candidate: string }
        Returns: boolean
      }
      is_public_user_number_available: {
        Args: { candidate: string }
        Returns: boolean
      }
      login_throttle_check: {
        Args: {
          p_identifier_hash: string
          p_ip_hash: string
          p_window_seconds?: number
        }
        Returns: {
          identifier_failures: number
          ip_attempts: number
          ip_failures: number
        }[]
      }
      login_throttle_record: {
        Args: {
          p_identifier_hash: string
          p_ip_hash: string
          p_success: boolean
        }
        Returns: undefined
      }
      match_services: {
        Args: { query_embedding: string }
        Returns: {
          name_en: string
          name_fr: string
          similarity: number
        }[]
      }
      moderate_job_request_admin: {
        Args: { p_reason: string; p_request_id: string }
        Returns: Json
      }
      my_voice_pin_status: { Args: never; Returns: Json }
      normalize_name: { Args: { n: string }; Returns: string }
      platform_admin_emails: { Args: never; Returns: string[] }
      platform_keepalive_ping: { Args: never; Returns: string }
      pro_billing_ready: {
        Args: { p_pro_profile_id: string }
        Returns: boolean
      }
      pro_client_history: { Args: { p_pro_profile_id: string }; Returns: Json }
      pro_client_request_limit: { Args: { p_tier: string }; Returns: number }
      pro_effective_tier: {
        Args: { p_pro_profile_id: string }
        Returns: string
      }
      pro_has_growth_tools: {
        Args: { p_pro_profile_id: string }
        Returns: boolean
      }
      pro_response_time_summary: {
        Args: { p_pro_profile_id: string }
        Returns: {
          median_minutes: number
          sample_size: number
        }[]
      }
      pro_weekly_window: {
        Args: { p_availability: string; p_dow: number }
        Returns: unknown
      }
      purge_job_requests_older_than_seven_days: { Args: never; Returns: number }
      rebook_reminder_candidates: {
        Args: { p_limit?: number }
        Returns: {
          anchor_booking_id: string
          attempts: number
          client_id: string
          due_date: string
          last_visit: string
          pro_profile_id: string
          service_category_slug: string
          service_slug: string
          tier: string
        }[]
      }
      rebook_unsubscribe: { Args: { p_token: string }; Returns: boolean }
      reconcile_my_referrals: { Args: never; Returns: number }
      remove_pro_by_admin: {
        Args: { p_pro_profile_id: string }
        Returns: undefined
      }
      resolve_public_handle: { Args: { p_handle: string }; Returns: Json }
      set_front_desk_voice_pin: {
        Args: { p_pin: string; p_user_id: string }
        Returns: boolean
      }
      set_my_username: { Args: { p_username: string }; Returns: Json }
      set_my_voice_pin: { Args: { new_pin: string }; Returns: Json }
      username_available: { Args: { p_username: string }; Returns: Json }
      username_generate_unique: { Args: { p_seed: string }; Returns: string }
      username_is_held_for_other: {
        Args: { p_user_id: string; p_username: string }
        Returns: boolean
      }
      username_is_reserved: { Args: { p_username: string }; Returns: boolean }
      username_slug: { Args: { p_raw: string }; Returns: string }
      verify_voice_pin_hash: {
        Args: { p_hash: string; p_pin: string }
        Returns: boolean
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
