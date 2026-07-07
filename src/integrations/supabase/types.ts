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
          comissao_percentual: number | null
          complemento: string | null
          created_at: string
          created_by: string | null
          data_venda: string | null
          documento: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          forma_pagamento: string | null
          id: string
          nome: string
          numero: string | null
          numero_proposta: string | null
          observacoes: string | null
          telefone: string | null
          tipo: string
          updated_at: string
          valor_total: number | null
          vendedor_id: string | null
        }
        Insert: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          comissao_percentual?: number | null
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          data_venda?: string | null
          documento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          forma_pagamento?: string | null
          id?: string
          nome: string
          numero?: string | null
          numero_proposta?: string | null
          observacoes?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
          valor_total?: number | null
          vendedor_id?: string | null
        }
        Update: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          comissao_percentual?: number | null
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          data_venda?: string | null
          documento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          forma_pagamento?: string | null
          id?: string
          nome?: string
          numero?: string | null
          numero_proposta?: string | null
          observacoes?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
          valor_total?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_lancamentos: {
        Row: {
          categoria: string | null
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento: string | null
          id: string
          obra_id: string | null
          obra_numero: number | null
          observacoes: string | null
          orcamento_id: string | null
          orcamento_numero: number | null
          status: Database["public"]["Enums"]["financeiro_status"]
          tipo: Database["public"]["Enums"]["financeiro_tipo"]
          updated_at: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento?: string | null
          id?: string
          obra_id?: string | null
          obra_numero?: number | null
          observacoes?: string | null
          orcamento_id?: string | null
          orcamento_numero?: number | null
          status?: Database["public"]["Enums"]["financeiro_status"]
          tipo: Database["public"]["Enums"]["financeiro_tipo"]
          updated_at?: string
          valor?: number
        }
        Update: {
          categoria?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          obra_id?: string | null
          obra_numero?: number | null
          observacoes?: string | null
          orcamento_id?: string | null
          orcamento_numero?: number | null
          status?: Database["public"]["Enums"]["financeiro_status"]
          tipo?: Database["public"]["Enums"]["financeiro_tipo"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_lancamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_cronograma: {
        Row: {
          created_at: string
          data_conclusao: string | null
          data_prevista: string | null
          descricao: string | null
          id: string
          obra_id: string
          ordem: number
          status: Database["public"]["Enums"]["obra_cronograma_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_conclusao?: string | null
          data_prevista?: string | null
          descricao?: string | null
          id?: string
          obra_id: string
          ordem?: number
          status?: Database["public"]["Enums"]["obra_cronograma_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_conclusao?: string | null
          data_prevista?: string | null
          descricao?: string | null
          id?: string
          obra_id?: string
          ordem?: number
          status?: Database["public"]["Enums"]["obra_cronograma_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_cronograma_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_materiais: {
        Row: {
          created_at: string
          descricao: string
          id: string
          obra_id: string
          observacoes: string | null
          quantidade_prevista: number
          quantidade_utilizada: number
          unidade: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          obra_id: string
          observacoes?: string | null
          quantidade_prevista?: number
          quantidade_utilizada?: number
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          obra_id?: string
          observacoes?: string | null
          quantidade_prevista?: number
          quantidade_utilizada?: number
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_materiais_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_medicoes: {
        Row: {
          altura_mm: number | null
          ambiente: string
          created_at: string
          data_medicao: string
          id: string
          largura_mm: number | null
          obra_id: string
          observacoes: string | null
          quantidade: number
          responsavel_id: string | null
          updated_at: string
        }
        Insert: {
          altura_mm?: number | null
          ambiente: string
          created_at?: string
          data_medicao?: string
          id?: string
          largura_mm?: number | null
          obra_id: string
          observacoes?: string | null
          quantidade?: number
          responsavel_id?: string | null
          updated_at?: string
        }
        Update: {
          altura_mm?: number | null
          ambiente?: string
          created_at?: string
          data_medicao?: string
          id?: string
          largura_mm?: number | null
          obra_id?: string
          observacoes?: string | null
          quantidade?: number
          responsavel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_medicoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente_id: string | null
          cliente_nome: string | null
          complemento: string | null
          created_at: string
          created_by: string | null
          data_entrega_prevista: string | null
          data_entrega_real: string | null
          data_inicio_prevista: string | null
          descricao: string | null
          estado: string | null
          id: string
          logradouro: string | null
          numero: number
          numero_endereco: string | null
          observacoes: string | null
          orcamento_id: string | null
          orcamento_numero: number | null
          ordem_producao_id: string | null
          ordem_producao_numero: number | null
          progresso: number
          responsavel_id: string | null
          responsavel_nome: string | null
          status: Database["public"]["Enums"]["obra_status"]
          titulo: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          data_entrega_prevista?: string | null
          data_entrega_real?: string | null
          data_inicio_prevista?: string | null
          descricao?: string | null
          estado?: string | null
          id?: string
          logradouro?: string | null
          numero?: number
          numero_endereco?: string | null
          observacoes?: string | null
          orcamento_id?: string | null
          orcamento_numero?: number | null
          ordem_producao_id?: string | null
          ordem_producao_numero?: number | null
          progresso?: number
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["obra_status"]
          titulo: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          data_entrega_prevista?: string | null
          data_entrega_real?: string | null
          data_inicio_prevista?: string | null
          descricao?: string | null
          estado?: string | null
          id?: string
          logradouro?: string | null
          numero?: number
          numero_endereco?: string | null
          observacoes?: string | null
          orcamento_id?: string | null
          orcamento_numero?: number | null
          ordem_producao_id?: string | null
          ordem_producao_numero?: number | null
          progresso?: number
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["obra_status"]
          titulo?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "obras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao"
            referencedColumns: ["id"]
          },
        ]
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
      ordem_producao_etapas: {
        Row: {
          concluida_em: string | null
          created_at: string
          etapa: string
          id: string
          iniciada_em: string
          observacoes: string | null
          ordem_id: string
          responsavel_id: string | null
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          etapa: string
          id?: string
          iniciada_em?: string
          observacoes?: string | null
          ordem_id: string
          responsavel_id?: string | null
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          etapa?: string
          id?: string
          iniciada_em?: string
          observacoes?: string | null
          ordem_id?: string
          responsavel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordem_producao_etapas_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_producao: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          created_by: string | null
          data_entrega: string | null
          data_inicio: string | null
          data_previsao: string | null
          descricao: string | null
          etapa: string
          id: string
          numero: number
          observacoes: string | null
          orcamento_id: string | null
          orcamento_numero: number | null
          prioridade: string
          progresso: number
          responsavel_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_entrega?: string | null
          data_inicio?: string | null
          data_previsao?: string | null
          descricao?: string | null
          etapa?: string
          id?: string
          numero?: number
          observacoes?: string | null
          orcamento_id?: string | null
          orcamento_numero?: number | null
          prioridade?: string
          progresso?: number
          responsavel_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_entrega?: string | null
          data_inicio?: string | null
          data_previsao?: string | null
          descricao?: string | null
          etapa?: string
          id?: string
          numero?: number
          observacoes?: string | null
          orcamento_id?: string | null
          orcamento_numero?: number | null
          prioridade?: string
          progresso?: number
          responsavel_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordens_producao_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
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
      vendedores: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          documento: string | null
          email: string | null
          id: string
          meta_mensal: number | null
          nome: string
          observacoes: string | null
          percentual_comissao: number
          percentual_comissao_meta: number | null
          telefone: string | null
          tipo_comissao: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          documento?: string | null
          email?: string | null
          id?: string
          meta_mensal?: number | null
          nome: string
          observacoes?: string | null
          percentual_comissao?: number
          percentual_comissao_meta?: number | null
          telefone?: string | null
          tipo_comissao?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          documento?: string | null
          email?: string | null
          id?: string
          meta_mensal?: number | null
          nome?: string
          observacoes?: string | null
          percentual_comissao?: number
          percentual_comissao_meta?: number | null
          telefone?: string | null
          tipo_comissao?: string
          updated_at?: string
          user_id?: string | null
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
      financeiro_status: "pendente" | "pago" | "atrasado" | "cancelado"
      financeiro_tipo: "receita" | "despesa"
      obra_cronograma_status:
        | "pendente"
        | "em_andamento"
        | "concluida"
        | "atrasada"
      obra_status:
        | "planejamento"
        | "aguardando_material"
        | "em_medicao"
        | "em_instalacao"
        | "concluida"
        | "cancelada"
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
      financeiro_status: ["pendente", "pago", "atrasado", "cancelado"],
      financeiro_tipo: ["receita", "despesa"],
      obra_cronograma_status: [
        "pendente",
        "em_andamento",
        "concluida",
        "atrasada",
      ],
      obra_status: [
        "planejamento",
        "aguardando_material",
        "em_medicao",
        "em_instalacao",
        "concluida",
        "cancelada",
      ],
    },
  },
} as const
