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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          company_id: string
          content: string | null
          created_at: string
          id: string
          new_stage: Database["public"]["Enums"]["deal_stage"] | null
          old_stage: Database["public"]["Enums"]["deal_stage"] | null
          type: Database["public"]["Enums"]["activity_type"]
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          company_id: string
          content?: string | null
          created_at?: string
          id?: string
          new_stage?: Database["public"]["Enums"]["deal_stage"] | null
          old_stage?: Database["public"]["Enums"]["deal_stage"] | null
          type?: Database["public"]["Enums"]["activity_type"]
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          content?: string | null
          created_at?: string
          id?: string
          new_stage?: Database["public"]["Enums"]["deal_stage"] | null
          old_stage?: Database["public"]["Enums"]["deal_stage"] | null
          type?: Database["public"]["Enums"]["activity_type"]
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          ai_readiness: string | null
          ai_recommendation: string | null
          assigned_email: string | null
          confidence: number | null
          created_at: string
          created_by: string | null
          deal_value: number | null
          digital_maturity: string | null
          digital_maturity_rating: string | null
          id: string
          industry: string | null
          industry_profile: string | null
          location: string | null
          lost_reason: string | null
          name: string
          priority: number | null
          problem_statements: string | null
          process_assessment: string | null
          product_mapping_table: string | null
          relevant_products: string[] | null
          stage: Database["public"]["Enums"]["deal_stage"]
          top_fits: string | null
          updated_at: string
        }
        Insert: {
          ai_readiness?: string | null
          ai_recommendation?: string | null
          assigned_email?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          deal_value?: number | null
          digital_maturity?: string | null
          digital_maturity_rating?: string | null
          id?: string
          industry?: string | null
          industry_profile?: string | null
          location?: string | null
          lost_reason?: string | null
          name: string
          priority?: number | null
          problem_statements?: string | null
          process_assessment?: string | null
          product_mapping_table?: string | null
          relevant_products?: string[] | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          top_fits?: string | null
          updated_at?: string
        }
        Update: {
          ai_readiness?: string | null
          ai_recommendation?: string | null
          assigned_email?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          deal_value?: number | null
          digital_maturity?: string | null
          digital_maturity_rating?: string | null
          id?: string
          industry?: string | null
          industry_profile?: string | null
          location?: string | null
          lost_reason?: string | null
          name?: string
          priority?: number | null
          problem_statements?: string | null
          process_assessment?: string | null
          product_mapping_table?: string | null
          relevant_products?: string[] | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          top_fits?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_research: {
        Row: {
          ai_readiness: string | null
          ai_recommendation: string | null
          company_id: string
          confidence: number | null
          created_at: string
          created_by: string | null
          created_email: string | null
          digital_maturity: string | null
          digital_maturity_rating: string | null
          id: string
          industry_profile: string | null
          model: string | null
          problem_statements: string | null
          process_assessment: string | null
          product_mapping_table: Json | null
          relevant_products: string[] | null
          top_fits: string | null
        }
        Insert: {
          ai_readiness?: string | null
          ai_recommendation?: string | null
          company_id: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          created_email?: string | null
          digital_maturity?: string | null
          digital_maturity_rating?: string | null
          id?: string
          industry_profile?: string | null
          model?: string | null
          problem_statements?: string | null
          process_assessment?: string | null
          product_mapping_table?: Json | null
          relevant_products?: string[] | null
          top_fits?: string | null
        }
        Update: {
          ai_readiness?: string | null
          ai_recommendation?: string | null
          company_id?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          created_email?: string | null
          digital_maturity?: string | null
          digital_maturity_rating?: string | null
          id?: string
          industry_profile?: string | null
          model?: string | null
          problem_statements?: string | null
          process_assessment?: string | null
          product_mapping_table?: Json | null
          relevant_products?: string[] | null
          top_fits?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company_id: string
          created_at: string
          department: string | null
          email: string | null
          found_on: string | null
          id: string
          linkedin: string | null
          name: string
          outreach_angle: string | null
          phone: string | null
          profile: string | null
          recent_activity: string | null
          source: string | null
          title: string | null
          twitter: string | null
          why: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          department?: string | null
          email?: string | null
          found_on?: string | null
          id?: string
          linkedin?: string | null
          name: string
          outreach_angle?: string | null
          phone?: string | null
          profile?: string | null
          recent_activity?: string | null
          source?: string | null
          title?: string | null
          twitter?: string | null
          why?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          department?: string | null
          email?: string | null
          found_on?: string | null
          id?: string
          linkedin?: string | null
          name?: string
          outreach_angle?: string | null
          phone?: string | null
          profile?: string | null
          recent_activity?: string | null
          source?: string | null
          title?: string | null
          twitter?: string | null
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          message: string | null
          read: boolean
          type: string | null
          user_email: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          type?: string | null
          user_email?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          type?: string | null
          user_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach: {
        Row: {
          company_id: string
          contact_name: string | null
          created_at: string
          department: string | null
          email_body: string | null
          email_subject: string | null
          id: string
          linkedin_connect: string | null
          linkedin_followup: string | null
        }
        Insert: {
          company_id: string
          contact_name?: string | null
          created_at?: string
          department?: string | null
          email_body?: string | null
          email_subject?: string | null
          id?: string
          linkedin_connect?: string | null
          linkedin_followup?: string | null
        }
        Update: {
          company_id?: string
          contact_name?: string | null
          created_at?: string
          department?: string | null
          email_body?: string | null
          email_subject?: string | null
          id?: string
          linkedin_connect?: string | null
          linkedin_followup?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_order: {
        Row: {
          company_id: string
          contact_name: string | null
          id: string
          rank: number
          reason: string | null
        }
        Insert: {
          company_id: string
          contact_name?: string | null
          id?: string
          rank: number
          reason?: string | null
        }
        Update: {
          company_id?: string
          contact_name?: string | null
          id?: string
          rank?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_order_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          archived: boolean
          archived_date: string | null
          capabilities: string[] | null
          created_at: string
          differentiators: string[] | null
          id: string
          name: string
          notes: string[] | null
          problems: string[] | null
          subtitle: string | null
          updated_at: string
          what: string | null
          who: string | null
        }
        Insert: {
          archived?: boolean
          archived_date?: string | null
          capabilities?: string[] | null
          created_at?: string
          differentiators?: string[] | null
          id?: string
          name: string
          notes?: string[] | null
          problems?: string[] | null
          subtitle?: string | null
          updated_at?: string
          what?: string | null
          who?: string | null
        }
        Update: {
          archived?: boolean
          archived_date?: string | null
          capabilities?: string[] | null
          created_at?: string
          differentiators?: string[] | null
          id?: string
          name?: string
          notes?: string[] | null
          problems?: string[] | null
          subtitle?: string | null
          updated_at?: string
          what?: string | null
          who?: string | null
        }
        Relationships: []
      }
      profile: {
        Row: {
          about: string | null
          certifications: string | null
          company_name: string | null
          founded: string | null
          id: string
          metrics: Json | null
          model: string | null
          presence: string | null
          sectors: string | null
          tagline: string | null
          team_size: string | null
          updated_at: string
          value_props: string[] | null
          website: string | null
        }
        Insert: {
          about?: string | null
          certifications?: string | null
          company_name?: string | null
          founded?: string | null
          id?: string
          metrics?: Json | null
          model?: string | null
          presence?: string | null
          sectors?: string | null
          tagline?: string | null
          team_size?: string | null
          updated_at?: string
          value_props?: string[] | null
          website?: string | null
        }
        Update: {
          about?: string | null
          certifications?: string | null
          company_name?: string | null
          founded?: string | null
          id?: string
          metrics?: Json | null
          model?: string | null
          presence?: string | null
          sectors?: string | null
          tagline?: string | null
          team_size?: string | null
          updated_at?: string
          value_props?: string[] | null
          website?: string | null
        }
        Relationships: []
      }
      queue: {
        Row: {
          card_data: string | null
          card_name: string | null
          company_id: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_title: string | null
          created_at: string
          has_card: boolean | null
          id: string
          location: string | null
          notes: string | null
          status: string
          submitted_by: string | null
          submitted_email: string | null
        }
        Insert: {
          card_data?: string | null
          card_name?: string | null
          company_id?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          created_at?: string
          has_card?: boolean | null
          id?: string
          location?: string | null
          notes?: string | null
          status?: string
          submitted_by?: string | null
          submitted_email?: string | null
        }
        Update: {
          card_data?: string | null
          card_name?: string | null
          company_id?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          created_at?: string
          has_card?: boolean | null
          id?: string
          location?: string | null
          notes?: string | null
          status?: string
          submitted_by?: string | null
          submitted_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write_company: { Args: { _company_id: string }; Returns: boolean }
      claim_qitt_role: { Args: never; Returns: undefined }
      expire_stale_queue: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      activity_type: "note" | "stage_change" | "system"
      app_role: "admin" | "ae" | "viewer"
      deal_stage:
        | "new"
        | "researched"
        | "contact_identified"
        | "contacted"
        | "meeting_booked"
        | "proposal_sent"
        | "contract_signed"
        | "won"
        | "lost"
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
    Enums: {
      activity_type: ["note", "stage_change", "system"],
      app_role: ["admin", "ae", "viewer"],
      deal_stage: [
        "new",
        "researched",
        "contact_identified",
        "contacted",
        "meeting_booked",
        "proposal_sent",
        "contract_signed",
        "won",
        "lost",
      ],
    },
  },
} as const
