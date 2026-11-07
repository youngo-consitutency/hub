import type { AnyValue } from './types'
import { useApi } from './api'
import { useDocument } from './documents'

// Live working-group vocabulary: the `working-groups` collection is the
// source of truth for slugs/names/topics; the `directory` document holds the
// broad topic labels. SWR dedupes the fetch across callers.
export function useWorkingGroups() {
  const query = useApi('/groups')
  const { doc: directory } = useDocument('directory')
  const groups = query.data?.items || []
  const topics = directory?.topics || []
  const bySlug = new Map<AnyValue, AnyValue>(groups.map((g: AnyValue) => [g.slug, g]))
  const label = (slug: AnyValue) => bySlug.get(slug)?.name || slug
  const topicLabel = (key: AnyValue) => topics.find((t: AnyValue) => t.key === key)?.label || null
  return { query, groups, topics, bySlug, label, topicLabel }
}

// a group's current contact points with their profiles, from authority
// records through the people endpoint (same source as the directory)
export function useContactPoints(slug?: string | null) {
  const query = useApi(
    slug
      ? `/member/people?workingGroup=${encodeURIComponent(slug)}&workingGroupRole=manager&pageSize=12`
      : null,
    [slug],
  )
  return { ...query, people: (query.data?.items || []) as AnyValue[] }
}
