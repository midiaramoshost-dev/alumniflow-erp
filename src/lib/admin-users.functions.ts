import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "admin" | "vendedor" | "producao" | "financeiro_obra";

const ALLOWED_ROLES: AppRole[] = ["admin", "vendedor", "producao", "financeiro_obra"];

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdminRow, error: roleErr } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (roleErr) throw new Error(roleErr.message);
  if (!isAdminRow) throw new Error("Apenas administradores podem gerenciar usuários");
}

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
      const roles = (data.roles ?? []).filter((r) => ALLOWED_ROLES.includes(r));
      return {
        email: data.email.trim().toLowerCase(),
        password: data.password,
        full_name: data.full_name?.trim() || null,
        roles,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.full_name ? { full_name: data.full_name } : undefined,
    });
    if (createErr) throw new Error(createErr.message);
    const newUserId = created.user?.id;
    if (!newUserId) throw new Error("Falha ao criar usuário");

    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: newUserId, email: data.email, full_name: data.full_name },
        { onConflict: "id" },
      );

    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    if (data.roles.length > 0) {
      const rows = data.roles.map((r) => ({ user_id: newUserId, role: r }));
      const { error: insErr } = await supabaseAdmin.from("user_roles").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    return { ok: true as const, user_id: newUserId };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      user_id: string;
      email?: string | null;
      full_name?: string | null;
      password?: string | null;
      roles?: AppRole[];
    }) => {
      if (!data?.user_id) throw new Error("user_id obrigatório");
      const out: {
        user_id: string;
        email?: string;
        full_name?: string | null;
        password?: string;
        roles?: AppRole[];
      } = { user_id: data.user_id };

      if (typeof data.email === "string" && data.email.trim().length > 0) {
        const e = data.email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("E-mail inválido");
        out.email = e;
      }
      if (data.full_name !== undefined) {
        out.full_name =
          typeof data.full_name === "string" && data.full_name.trim().length > 0
            ? data.full_name.trim()
            : null;
      }
      if (typeof data.password === "string" && data.password.length > 0) {
        if (data.password.length < 8) throw new Error("Senha deve ter pelo menos 8 caracteres");
        out.password = data.password;
      }
      if (Array.isArray(data.roles)) {
        out.roles = data.roles.filter((r) => ALLOWED_ROLES.includes(r));
      }
      return out;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Update auth (email/password/metadata)
    const authAttrs: Record<string, unknown> = {};
    if (data.email) authAttrs.email = data.email;
    if (data.password) authAttrs.password = data.password;
    if (data.full_name !== undefined) {
      authAttrs.user_metadata = data.full_name ? { full_name: data.full_name } : {};
    }
    if (Object.keys(authAttrs).length > 0) {
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
        data.user_id,
        authAttrs,
      );
      if (updErr) throw new Error(updErr.message);
    }

    // Sync profile
    const profileUpdate: Record<string, unknown> = {};
    if (data.email) profileUpdate.email = data.email;
    if (data.full_name !== undefined) profileUpdate.full_name = data.full_name;
    if (Object.keys(profileUpdate).length > 0) {
      const { error: profErr } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", data.user_id);
      if (profErr) throw new Error(profErr.message);
    }

    // Reset roles when provided
    if (data.roles) {
      // Prevent removing admin from self
      if (data.user_id === context.userId && !data.roles.includes("admin")) {
        throw new Error("Você não pode remover sua própria função de administrador");
      }
      const { error: delErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id);
      if (delErr) throw new Error(delErr.message);
      if (data.roles.length > 0) {
        const rows = data.roles.map((r) => ({ user_id: data.user_id, role: r }));
        const { error: insErr } = await supabaseAdmin.from("user_roles").insert(rows);
        if (insErr) throw new Error(insErr.message);
      }
    }

    return { ok: true as const };
  });
