import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { user, login, register, loginStatus, registerStatus } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    password: "",
  });

  const searchParams = useMemo(() => new URLSearchParams(window.location.search), [location]);
  const redirectTo = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (user) {
      setLocation(redirectTo);
    }
  }, [user, redirectTo, setLocation]);

  const isSubmitting = mode === "login" ? loginStatus === "pending" : registerStatus === "pending";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (mode === "register" && !formState.name.trim()) {
      toast({
        title: "Informe seu nome",
        variant: "destructive",
      });
      return;
    }

    try {
      if (mode === "login") {
        await login({ email: formState.email, password: formState.password });
      } else {
        await register({ name: formState.name, email: formState.email, password: formState.password });
      }
      setLocation(redirectTo);
    } catch (error: any) {
      toast({
        title: "Não foi possível autenticar",
        description: error?.message || "Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-md mx-auto px-4 md:px-6 lg:px-8 py-12">
        <Card>
          <CardHeader>
            <CardTitle>{mode === "login" ? "Entrar" : "Criar conta"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Acesse sua conta para consultar importadores, exportadores e NCMs."
                : "Cadastre-se para contratar um plano e iniciar suas consultas."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name"
                    value={formState.name}
                    onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Seu nome"
                    required={mode === "register"}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formState.email}
                  onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="voce@empresa.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={formState.password}
                  onChange={(event) => setFormState((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Sua senha"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {mode === "login" ? "Entrar" : "Criar conta"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <button
                  type="button"
                  className="underline"
                  onClick={() => setMode("register")}
                >
                  Ainda não tem conta? Cadastre-se agora
                </button>
              ) : (
                <button
                  type="button"
                  className="underline"
                  onClick={() => setMode("login")}
                >
                  Já possui uma conta? Faça login
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
