import { redirect } from "next/navigation";

// Recharges had a page of their own for a day; they live with the subscriptions now.
export default function Recharges() {
  redirect("/subscriptions#recharges");
}
