import { notFound } from 'next/navigation'

// every real page has its own route, so anything landing here is unknown: answer 404, not a soft 200
export default function Page() {
  notFound()
}
