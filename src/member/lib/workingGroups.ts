import type { GroupSummary, PeopleResponse } from '../../shared/contracts'
import { useApi } from './api'
import { useDocument } from './documents'

// Working-group vocabulary: the `working-groups` collection is the source of truth; `directory` holds topic labels.
export function useWorkingGroups() {
  const query = useApi<{ items: GroupSummary[] }>('/groups')
  const { doc: directory } = useDocument<{ topics?: { key: string; label: string }[] }>('directory')
  const groups = query.data?.items ?? []
  const topics = directory?.topics ?? []
  const bySlug = new Map(groups.map((g) => [g.slug, g]))
  const label = (slug: string) => bySlug.get(slug)?.name || slug
  const topicLabel = (key: string) => topics.find((t) => t.key === key)?.label || null
  return { query, groups, topics, bySlug, label, topicLabel }
}

// a group's current contact points with their profiles, from authority
// records through the people endpoint (same source as the directory)
export function useContactPoints(slug?: string | null) {
  const query = useApi<PeopleResponse>(
    slug
      ? `/member/people?workingGroup=${encodeURIComponent(slug)}&workingGroupRole=manager&pageSize=12`
      : null,
  )
  return { ...query, people: query.data?.items || [] }
}
