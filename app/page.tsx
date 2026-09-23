import { redirect } from "next/navigation";

/** The product starts at the demo identity picker - there is nothing to show before signing in. */
export default function Page() {
  redirect("/login");
}
