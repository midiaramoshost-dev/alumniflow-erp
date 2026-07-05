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
      acessorios: {
        Row: {
          ativo: boolean
          categoria: string | null
          codigo: string
          created_at: string
          descricao: string
          estoque_atual: number | null
          estoque_minimo: number | null
          id: string
          observacoes: string | null
          preco_unitario: number | null
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          codigo: string
          created_at?: string
          descricao: string
          estoque_atual?: number | null
          estoque_minimo?: number | null
          id?: string
          observacoes?: string | null
          preco_unitario?: number | null
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          codigo?: string
          created_at?: string
          descricao?: string
          estoque_atual?: number | null
          estoque_minimo?: number | null
          id?: string
          observacoes?: string | null
          preco_unitario?: number | null
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          bairro: string | null
          celular: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          created_at: string
          created_by: string | null
          documento: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          numero: string | null
          observacoes: string | null
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          documento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          numero?: string | null
          observacoes?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          documento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          numero?: string | null
          observacoes?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      orcamento_itens: {
        Row: {
          altura_mm: number | null
          created_at: string
          descricao: string
          id: string
          largura_mm: number | null
          observacoes: string | null
          orcamento_id: string
          ordem: number
          perfil_id: string | null
          preco_unitario: number
          quantidade: number
          subtotal: number
          tipo: string | null
          updated_at: string
          vidro_id: string | null
        }
        Insert: {
          altura_mm?: number | null
          created_at?: string
          descricao: string
          id?: string
          largura_mm?: number | null
          observacoes?: string | null
          orcamento_id: string
          ordem?: number
          perfil_id?: string | null
          preco_unitario?: number
          quantidade?: number
          subtotal?: number
          tipo?: string | null
          updated_at?: string
          vidro_id?: string | null
        }
        Update: {
          altura_mm?: number | null
          created_at?: string
          descricao?: string
          id?: string
          largura_mm?: number | null
          observacoes?: string | null
          orcamento_id?: string
          ordem?: number
          perfil_id?: string | null
          preco_unitario?: number
          quantidade?: number
          subtotal?: number
          tipo?: string | null
          updated_at?: string
          vidro_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_aluminio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_vidro_id_fkey"
            columns: ["vidro_id"]
            isOneToOne: false
            referencedRelation: "vidros"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          created_by: string | null
          data_orcamento: string
          desconto: number
          id: string
          numero: number
          observacoes: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          validade_dias: number
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_orcamento?: string
          desconto?: number
          id?: string
          numero?: number
          observacoes?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          validade_dias?: number
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_orcamento?: string
          desconto?: number
          id?: string
          numero?: number
          observacoes?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          validade_dias?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_aluminio: {
        Row: {
          acabamento: string | null
          ativo: boolean
          codigo: string
          comprimento_barra_mm: number
          cor: string | null
          created_at: string
          descricao: string
          estoque_atual: number | null
          estoque_minimo: number | null
          id: string
          linha: string | null
          observacoes: string | null
          peso_kg_m: number | null
          preco_kg: number | null
          preco_metro: number | null
          updated_at: string
        }
        Insert: {
          acabamento?: string | null
          ativo?: boolean
          codigo: string
          comprimento_barra_mm?: number
          cor?: string | null
          created_at?: string
          descricao: string
          estoque_atual?: number | null
          estoque_minimo?: number | null
          id?: string
          linha?: string | null
          observacoes?: string | null
          peso_kg_m?: number | null
          preco_kg?: number | null
          preco_metro?: number | null
          updated_at?: string
        }
        Update: {
          acabamento?: string | null
          ativo?: boolean
          codigo?: string
          comprimento_barra_mm?: number
          cor?: string | null
          created_at?: string
          descricao?: string
          estoque_atual?: number | null
          estoque_minimo?: number | null
          id?: string
          linha?: string | null
          observacoes?: string | null
          peso_kg_m?: number | null
          preco_kg?: number | null
          preco_metro?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
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
      vidros: {
        Row: {
          ativo: boolean
          codigo: string
          cor: string | null
          created_at: string
          descricao: string
          espessura_mm: number | null
          estoque_m2: number | null
          id: string
          observacoes: string | null
          preco_m2: number | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          cor?: string | null
          created_at?: string
          descricao: string
          espessura_mm?: number | null
          estoque_m2?: number | null
          id?: string
          observacoes?: string | null
          preco_m2?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          cor?: string | null
          created_at?: string
          descricao?: string
          espessura_mm?: number | null
          estoque_m2?: number | null
          id?: string
          observacoes?: string | null
          preco_m2?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "vendedor" | "producao" | "financeiro_obra"
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
      app_role: ["admin", "vendedor", "producao", "financeiro_obra"],
    },
  },
} as const
