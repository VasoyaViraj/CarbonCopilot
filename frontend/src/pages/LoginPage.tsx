import { useState, type ChangeEvent, type FormEvent } from "react"
import { Navigate, useLocation } from "react-router"
import { CircleAlert, Leaf } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input, Select } from "@/components/ui/input"
import FormField from "@/components/forms/FormField"
import LoadingState from "@/components/feedback/LoadingState"
import { useAuth } from "@/hooks/useAuth"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { getApiErrorMessage, getApiFieldErrors } from "@/services/apiClient"
import type { RegisterInput } from "@/services/authService"
import { ROLE_LABELS, SELF_REGISTRABLE_ROLES } from "@/utils/roles"

type Mode = "login" | "register"

const EMPTY_FORM = {
  name: "",
  organizationName: "",
  email: "",
  password: "",
  role: "FACTORY_OPERATOR" as RegisterInput["role"],
}

export default function LoginPage() {
  const { status, login, register } = useAuth()
  const location = useLocation()
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard"

  const [mode, setMode] = useState<Mode>("login")
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useDocumentTitle(mode === "login" ? "Sign in" : "Create account")

  if (status === "authenticated") return <Navigate to={redirectTo} replace />
  if (status === "loading") return <LoadingState label="Restoring your session…" className="min-h-svh" />

  const update = (field: keyof typeof EMPTY_FORM) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }))

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setFieldErrors({})
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      if (mode === "login") {
        await login(form.email, form.password)
      } else {
        await register({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          organizationName: form.organizationName.trim() || undefined,
        })
      }
      // On success the auth status changes and this page redirects via <Navigate>.
    } catch (err) {
      setError(getApiErrorMessage(err, mode === "login" ? "Sign-in failed. Please try again." : "Registration failed."))
      setFieldErrors(getApiFieldErrors(err))
    } finally {
      setSubmitting(false)
    }
  }

  const isRegister = mode === "register"

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Leaf className="size-5" aria-hidden />
          </div>
          <h1 className="font-heading text-xl font-semibold">{isRegister ? "Create your account" : "Sign in to EcoTrace AI"}</h1>
          <p className="text-sm text-muted-foreground">Find your emission hotspots and what to fix first.</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          {isRegister && (
            <>
              <FormField label="Full name" htmlFor="name" error={fieldErrors.name}>
                <Input id="name" autoComplete="name" value={form.name} onChange={update("name")} aria-invalid={!!fieldErrors.name} required />
              </FormField>
              <FormField label="Organization" htmlFor="organizationName" error={fieldErrors.organizationName} hint="A new organization is created for your account.">
                <Input id="organizationName" autoComplete="organization" value={form.organizationName} onChange={update("organizationName")} aria-invalid={!!fieldErrors.organizationName} />
              </FormField>
              <FormField label="Role" htmlFor="role" error={fieldErrors.role}>
                <Select id="role" value={form.role} onChange={update("role")}>
                  {SELF_REGISTRABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </Select>
              </FormField>
            </>
          )}

          <FormField label="Email" htmlFor="email" error={fieldErrors.email}>
            <Input id="email" type="email" autoComplete="email" value={form.email} onChange={update("email")} aria-invalid={!!fieldErrors.email} required />
          </FormField>
          <FormField label="Password" htmlFor="password" error={fieldErrors.password} hint={isRegister ? "At least 8 characters." : undefined}>
            <Input
              id="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={form.password}
              onChange={update("password")}
              aria-invalid={!!fieldErrors.password}
              required
            />
          </FormField>

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? (isRegister ? "Creating account…" : "Signing in…") : isRegister ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {isRegister ? "Already have an account?" : "New to EcoTrace AI?"}{" "}
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => switchMode(isRegister ? "login" : "register")}>
            {isRegister ? "Sign in" : "Create an account"}
          </button>
        </p>
      </Card>
    </div>
  )
}
