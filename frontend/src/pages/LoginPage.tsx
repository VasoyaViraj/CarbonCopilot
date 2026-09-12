import type { FormEvent } from "react"
import { useNavigate } from "react-router"
import { Leaf } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import FormField from "@/components/forms/FormField"
import NotConnectedNotice from "@/components/feedback/NotConnectedNotice"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"

export default function LoginPage() {
  useDocumentTitle("Sign in")
  const navigate = useNavigate()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    // Scaffold only: real JWT login is wired in the authentication phase.
    navigate("/dashboard")
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Leaf className="size-5" aria-hidden />
          </div>
          <h1 className="font-heading text-xl font-semibold">Sign in to EcoTrace AI</h1>
          <p className="text-sm text-muted-foreground">Find your emission hotspots and what to fix first.</p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormField label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required />
          </FormField>
          <FormField label="Password" htmlFor="password">
            <Input id="password" type="password" autoComplete="current-password" required />
          </FormField>
          <Button type="submit" size="lg" className="w-full">
            Sign in
          </Button>
          <NotConnectedNotice>Authentication is not connected yet — this form is a UI scaffold.</NotConnectedNotice>
        </form>
      </Card>
    </div>
  )
}
