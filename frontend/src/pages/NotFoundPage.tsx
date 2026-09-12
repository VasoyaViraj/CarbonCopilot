import { Link } from "react-router"
import { Compass } from "lucide-react"
import EmptyState from "@/components/feedback/EmptyState"
import { buttonVariants } from "@/components/ui/button"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"

export default function NotFoundPage() {
  useDocumentTitle("Page not found")
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you are looking for does not exist."
        action={
          <Link to="/dashboard" className={buttonVariants({ variant: "outline" })}>
            Back to dashboard
          </Link>
        }
      />
    </div>
  )
}
