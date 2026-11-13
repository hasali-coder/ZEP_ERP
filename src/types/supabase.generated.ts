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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          actor_id: string | null
          business_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          event_data: Json
          event_type: string
          id: number
        }
        Insert: {
          actor_id?: string | null
          business_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_data?: Json
          event_type: string
          id?: never
        }
        Update: {
          actor_id?: string | null
          business_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_data?: Json
          event_type?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          city: string | null
          country: string
          created_at: string
          currency: string
          email: string | null
          id: string
          logo_path: string | null
          name: string
          notes: string | null
          owner_id: string
          payment_instructions: string | null
          phone: string | null
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          logo_path?: string | null
          name: string
          notes?: string | null
          owner_id: string
          payment_instructions?: string | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          logo_path?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          payment_instructions?: string | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          business_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          kind: string
          name: string
          tax_rate_percent: number
          unit_price_minor: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind: string
          name: string
          tax_rate_percent?: number
          unit_price_minor?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          tax_rate_percent?: number
          unit_price_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          business_id: string
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
          currency_preference: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          tax_number: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          currency_preference?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          currency_preference?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount_minor: number
          business_id: string
          created_at: string
          credit_number: string
          currency: string
          customer_id: string
          id: string
          invoice_id: string | null
          issue_date: string
          reason: string
          status: string
        }
        Insert: {
          amount_minor: number
          business_id: string
          created_at?: string
          credit_number: string
          currency: string
          customer_id: string
          id?: string
          invoice_id?: string | null
          issue_date?: string
          reason?: string
          status?: string
        }
        Update: {
          amount_minor?: number
          business_id?: string
          created_at?: string
          credit_number?: string
          currency?: string
          customer_id?: string
          id?: string
          invoice_id?: string | null
          issue_date?: string
          reason?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "credit_notes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_business_id_invoice_id_fkey"
            columns: ["business_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      document_sequences: {
        Row: {
          business_id: string
          document_type: string
          next_number: number
          year: number
        }
        Insert: {
          business_id: string
          document_type: string
          next_number?: number
          year: number
        }
        Update: {
          business_id?: string
          document_type?: string
          next_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_sequences_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_minor: number
          business_id: string
          category: string
          created_at: string
          currency: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          payment_method: string | null
          reference_number: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          amount_minor: number
          business_id: string
          category?: string
          created_at?: string
          currency: string
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          reference_number?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          business_id?: string
          category?: string
          created_at?: string
          currency?: string
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          reference_number?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_business_id_supplier_id_fkey"
            columns: ["business_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount_minor: number
          business_id: string
          contact_id: string | null
          created_at: string
          currency: string
          description: string
          direction: string
          expense_id: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          payment_date: string
          payment_method: string
          reference_number: string | null
          status: string
        }
        Insert: {
          amount_minor: number
          business_id: string
          contact_id?: string | null
          created_at?: string
          currency: string
          description?: string
          direction: string
          expense_id?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          payment_date?: string
          payment_method: string
          reference_number?: string | null
          status?: string
        }
        Update: {
          amount_minor?: number
          business_id?: string
          contact_id?: string | null
          created_at?: string
          currency?: string
          description?: string
          direction?: string
          expense_id?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string
          reference_number?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_business_id_contact_id_fkey"
            columns: ["business_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "financial_transactions_business_id_expense_id_fkey"
            columns: ["business_id", "expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "financial_transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          business_id: string
          description: string
          discount_percent: number
          id: string
          invoice_id: string
          position: number
          quantity: number
          tax_rate_percent: number
          unit_price_minor: number
        }
        Insert: {
          business_id: string
          description: string
          discount_percent?: number
          id?: string
          invoice_id: string
          position?: number
          quantity: number
          tax_rate_percent?: number
          unit_price_minor: number
        }
        Update: {
          business_id?: string
          description?: string
          discount_percent?: number
          id?: string
          invoice_id?: string
          position?: number
          quantity?: number
          tax_rate_percent?: number
          unit_price_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_business_id_invoice_id_fkey"
            columns: ["business_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid_minor: number
          balance_due_minor: number | null
          business_id: string
          created_at: string
          currency: string
          customer_id: string
          discount_minor: number
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          payment_instructions: string | null
          payment_terms: string | null
          source_quotation_id: string | null
          status: string
          subtotal_minor: number
          tax_minor: number
          total_minor: number
          updated_at: string
        }
        Insert: {
          amount_paid_minor?: number
          balance_due_minor?: number | null
          business_id: string
          created_at?: string
          currency: string
          customer_id: string
          discount_minor?: number
          due_date: string
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          payment_instructions?: string | null
          payment_terms?: string | null
          source_quotation_id?: string | null
          status?: string
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          updated_at?: string
        }
        Update: {
          amount_paid_minor?: number
          balance_due_minor?: number | null
          business_id?: string
          created_at?: string
          currency?: string
          customer_id?: string
          discount_minor?: number
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          payment_instructions?: string | null
          payment_terms?: string | null
          source_quotation_id?: string | null
          status?: string
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_business_id_source_quotation_id_fkey"
            columns: ["business_id", "source_quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount_minor: number
          bill_id: string | null
          business_id: string
          created_at: string
          id: string
          invoice_id: string | null
          transaction_id: string
        }
        Insert: {
          amount_minor: number
          bill_id?: string | null
          business_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          transaction_id: string
        }
        Update: {
          amount_minor?: number
          bill_id?: string | null
          business_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_business_id_bill_id_fkey"
            columns: ["business_id", "bill_id"]
            isOneToOne: false
            referencedRelation: "supplier_bills"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "payment_allocations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_business_id_invoice_id_fkey"
            columns: ["business_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "payment_allocations_business_id_transaction_id_fkey"
            columns: ["business_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      quotation_items: {
        Row: {
          business_id: string
          description: string
          discount_percent: number
          id: string
          position: number
          quantity: number
          quotation_id: string
          tax_rate_percent: number
          unit_price_minor: number
        }
        Insert: {
          business_id: string
          description: string
          discount_percent?: number
          id?: string
          position?: number
          quantity: number
          quotation_id: string
          tax_rate_percent?: number
          unit_price_minor: number
        }
        Update: {
          business_id?: string
          description?: string
          discount_percent?: number
          id?: string
          position?: number
          quantity?: number
          quotation_id?: string
          tax_rate_percent?: number
          unit_price_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_business_id_quotation_id_fkey"
            columns: ["business_id", "quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      quotations: {
        Row: {
          business_id: string
          created_at: string
          currency: string
          customer_id: string
          discount_minor: number
          expiry_date: string
          id: string
          issue_date: string
          notes: string | null
          quote_number: string
          status: string
          subtotal_minor: number
          tax_minor: number
          total_minor: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          currency: string
          customer_id: string
          discount_minor?: number
          expiry_date: string
          id?: string
          issue_date?: string
          notes?: string | null
          quote_number: string
          status?: string
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          currency?: string
          customer_id?: string
          discount_minor?: number
          expiry_date?: string
          id?: string
          issue_date?: string
          notes?: string | null
          quote_number?: string
          status?: string
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotations_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "quotations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_bills: {
        Row: {
          amount_minor: number
          amount_paid_minor: number
          balance_due_minor: number | null
          bill_number: string
          business_id: string
          category: string | null
          created_at: string
          currency: string
          description: string
          due_date: string
          id: string
          issue_date: string
          notes: string | null
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          amount_minor: number
          amount_paid_minor?: number
          balance_due_minor?: number | null
          bill_number: string
          business_id: string
          category?: string | null
          created_at?: string
          currency: string
          description?: string
          due_date: string
          id?: string
          issue_date?: string
          notes?: string | null
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          amount_paid_minor?: number
          balance_due_minor?: number | null
          bill_number?: string
          business_id?: string
          category?: string | null
          created_at?: string
          currency?: string
          description?: string
          due_date?: string
          id?: string
          issue_date?: string
          notes?: string | null
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bills_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bills_business_id_supplier_id_fkey"
            columns: ["business_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
