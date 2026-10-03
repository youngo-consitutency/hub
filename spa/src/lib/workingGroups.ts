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
  const bySlug = new Map<any, any>(groups.map((g: any) => [g.slug, g]))
  const label = (slug: any) => bySlug.get(slug)?.name || slug
  const topicLabel = (key: any) => topics.find((t: any) => t.key === key)?.label || null
  return { query, groups, topics, bySlug, label, topicLabel }
}
