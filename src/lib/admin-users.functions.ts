import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "admin" | "vendedor" | "producao" | "financeiro_obra";

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      email: string;
      password: string;
      full_name?: string;
      roles: AppRole[];
    }) => {
      if (!data?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        throw new Error("E-mail inválido");
      }
      if (!data.password || data.password.length < 8) {
        throw new Error("Senha deve ter pelo menos 8 caracteres");
      }
      const allowed: AppRole[] = ["admin", "vendedor", "producao", "financeiro_obra"];
      const roles = (data.roles ?? []).filter((r) => allowed.includes(r));
      return {
        email: data.email.trim().toLowerCase(),
        password: data.password,
        full_name: data.full_name?.trim() || null,
        roles,
      };
    },
  )
  .handler(async ({ data, context }) => {
    // Only admins may create users
    const { data: isAdminRow, error: roleErr } = await context.supabase.rpc(
      "has_role",
      { _user_id: context.userId, _role: "admin" },
    );
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdminRow) throw new Error("Apenas administradores podem criar usuários");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create the user (email confirmed so they can log in immediately)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.full_name ? { full_name: data.full_name } : undefined,
    });
    if (createErr) throw new Error(createErr.message);
    const newUserId = created.user?.id;
    if (!newUserId) throw new Error("Falha ao criar usuário");

    // Ensure profile exists / is updated (handle_new_user trigger already creates it)
    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: newUserId, email: data.email, full_name: data.full_name },
        { onConflict: "id" },
      );

    // Reset roles to the selected set
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    if (data.roles.length > 0) {
      const rows = data.roles.map((r) => ({ user_id: newUserId, role: r }));
      const { error: insErr } = await supabaseAdmin.from("user_roles").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    return { ok: true as const, user_id: newUserId };
  });
