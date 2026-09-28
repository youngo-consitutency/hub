import { useApi } from './api.js'
import { useDocument } from './documents.js'

// Live working-group vocabulary: the `working-groups` collection is the
// source of truth for slugs/names/topics; the `directory` document holds the
// broad topic labels. SWR dedupes the fetch across callers.
export function useWorkingGroups() {
  const query = useApi('/groups')
  const { doc: directory } = useDocument('directory')
  const groups = query.data?.items || []
  const topics = directory?.topics || []
  const bySlug = new Map(groups.map((g) => [g.slug, g]))
  const label = (slug) => bySlug.get(slug)?.name || slug
  const topicLabel = (key) =>
    topics.find((t) => t.key === key)?.label || null
  return { query, groups, topics, bySlug, label, topicLabel }
}
