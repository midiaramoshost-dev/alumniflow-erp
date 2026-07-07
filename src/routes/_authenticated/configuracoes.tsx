import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/lib/theme-provider";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User as UserIcon,
  Lock,
  Palette,
  LogOut,
  Loader2,
  Sun,
  Moon,
  Monitor,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: SettingsPage,
});

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  producao: "Produção / PCP",
  financeiro_obra: "Financeiro & Obra",
};

function SettingsPage() {
  const { user, roles } = useAuth();

  return (
    <PageShell
      title="Configurações"
      description="Gerencie seu perfil, segurança e preferências"
      actions={
        <Badge variant="secondary" className="gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          {roles.map((r) => roleLabels[r] ?? r).join(", ") || "Sem função"}
        </Badge>
      }
    >
      <div className="p-4 md:p-6">
        <Tabs defaultValue="profile">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="profile" className="gap-1">
              <UserIcon className="h-3.5 w-3.5" /> Perfil
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1">
              <Lock className="h-3.5 w-3.5" /> Segurança
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1">
              <Palette className="h-3.5 w-3.5" /> Aparência
            </TabsTrigger>
            <TabsTrigger value="session" className="gap-1">
              <LogOut className="h-3.5 w-3.5" /> Sessão
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <ProfileCard userId={user?.id ?? ""} email={user?.email ?? ""} />
          </TabsContent>

          <TabsContent value="security" className="mt-4">
            <SecurityCard email={user?.email ?? ""} />
          </TabsContent>

          <TabsContent value="appearance" className="mt-4">
            <AppearanceCard />
          </TabsContent>

          <TabsContent value="session" className="mt-4">
            <SessionCard />
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}

/* ------------- Perfil ------------- */

function ProfileCard({ userId, email }: { userId: string; email: string }) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["settings", "profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from("profiles")
        .select("id, full_name, email, phone")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; full_name: string | null; email: string | null; phone: string | null } | null;
    },
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as unknown as { from: (t: string) => any })
        .from("profiles")
        .update({ full_name: fullName.trim() || null, phone: phone.trim() || null })
        .eq("id", userId);
      if (error) throw error;
      await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "profile", userId] });
      toast.success("Perfil atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" /> Meu perfil
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
          </div>
        ) : (
          <form
            className="grid gap-4 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={email} disabled />
              <p className="text-xs text-muted-foreground mt-1">
                Para alterar o e-mail, use a aba Segurança.
              </p>
            </div>
            <div>
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------- Segurança ------------- */

function SecurityCard({ email }: { email: string }) {
  const [newEmail, setNewEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busyEmail, setBusyEmail] = useState(false);
  const [busyPwd, setBusyPwd] = useState(false);

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setBusyEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setBusyEmail(false);
    if (error) return toast.error(error.message);
    toast.success("E-mail de confirmação enviado ao novo endereço");
    setNewEmail("");
  };

  const changePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) return toast.error("Senha deve ter no mínimo 6 caracteres");
    if (pwd !== pwd2) return toast.error("As senhas não conferem");
    setBusyPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusyPwd(false);
    if (error) return toast.error(error.message);
    setPwd("");
    setPwd2("");
    toast.success("Senha atualizada");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" /> Alterar senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePwd} className="space-y-4">
            <div>
              <Label htmlFor="pwd">Nova senha</Label>
              <Input
                id="pwd"
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <Label htmlFor="pwd2">Confirmar nova senha</Label>
              <Input
                id="pwd2"
                type="password"
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={busyPwd}>
                {busyPwd && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Atualizar senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" /> Alterar e-mail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changeEmail} className="space-y-4">
            <div>
              <Label>E-mail atual</Label>
              <Input value={email} disabled />
            </div>
            <div>
              <Label htmlFor="new-email">Novo e-mail</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="novo@exemplo.com"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Você receberá um e-mail de confirmação no novo endereço.
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={busyEmail}>
                {busyEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Solicitar alteração
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------- Aparência ------------- */

function AppearanceCard() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" /> Tema
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-w-md space-y-3">
          <Label>Modo de exibição</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4" /> Claro
                </div>
              </SelectItem>
              <SelectItem value="dark">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4" /> Escuro
                </div>
              </SelectItem>
              <SelectItem value="system">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" /> Sistema
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            A preferência é salva no seu navegador.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------- Sessão ------------- */

function SessionCard() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const doSignOut = async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
    navigate({ to: "/auth" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogOut className="h-5 w-5" /> Encerrar sessão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ao sair, você precisará entrar novamente com seu e-mail e senha.
        </p>
        <Button variant="destructive" onClick={doSignOut} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <LogOut className="mr-2 h-4 w-4" /> Sair agora
        </Button>
      </CardContent>
    </Card>
  );
}
