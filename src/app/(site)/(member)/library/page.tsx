import { redirect } from 'next/navigation'

export default function Page() {
  redirect('/resources?view=guides')
}
