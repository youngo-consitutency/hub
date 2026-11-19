import { createElement } from 'react'
import {
  TbBuildingCommunity as Building,
  TbBriefcase as Briefcase,
  TbMapPin as MapPin,
  TbTag as Tag,
} from 'react-icons/tb'
import type { PersonSummary } from '../../shared/contracts'
import { workingGroupIcon } from '../lib/workingGroupIcons'
import { MemberAvatar } from './MemberAvatar'
import { A } from './ui'

// Kept out of cards.tsx: MemberAvatar pulls in the avatar library (~108 KB gzip), which only the
// directory and group panel need. Every other screen importing cards.tsx would otherwise ship it.
interface PersonCardProps {
  person: PersonSummary
  onTagClick?: (tag: string) => void
  onOpen?: () => void
  expanded?: boolean
}

export function PersonCard({ person, onTagClick, onOpen, expanded = false }: PersonCardProps) {
  return (
    <article className={`card cardTight personCard ${expanded ? 'personDetail' : ''}`}>
      <header className="personCardHeader">
        <MemberAvatar person={person} size="lg" />
        <div>
          <h3>
            {onOpen ? (
              <button
                className="personNameButton"
                type="button"
                aria-haspopup="dialog"
                onClick={onOpen}
              >
                {person.displayName}
              </button>
            ) : (
              person.displayName
            )}
          </h3>
          {person.pronouns && <p className="metaMuted">{person.pronouns}</p>}
        </div>
      </header>
      {person.headline && <p className="personHeadline">{person.headline}</p>}
      {person.bio && <p className="meta personBio">{person.bio}</p>}
      {(person.country || person.organization) && (
        <div className="personConnections">
          {person.country && (
            <p className="entityCardMetaRow">
              <MapPin size={15} aria-hidden />
              <span>{person.country}</span>
            </p>
          )}
          {person.organization?.name && (
            <p className="entityCardMetaRow">
              <Building size={15} aria-hidden />
              <span>
                {person.organization.name}
                {person.organization.seatRole ? ` · ${person.organization.seatRole}` : ''}
              </span>
            </p>
          )}
        </div>
      )}
      {(person.teams?.length > 0 || person.platformRole) && (
        <div className="personRoles" aria-label="Hub roles">
          <Briefcase size={15} aria-hidden />
          <span>
            {[...person.teams.map((team) => team.name), person.platformRole?.replaceAll('_', ' ')]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      )}
      {person.workingGroups?.length > 0 && (
        <div className="entityCardTags personGroupTags" aria-label="Working groups">
          {person.workingGroups.slice(0, expanded ? undefined : 5).map((group) => {
            return (
              <A
                key={group.slug}
                href={`/groups/${group.slug}`}
                className="chip chip-neutral personLinkChip"
              >
                {createElement(workingGroupIcon(group.slug), {
                  size: 13,
                  strokeWidth: 1.75,
                  'aria-hidden': true,
                })}
                {group.name}
                {['contact', 'lead'].includes(group.role ?? '')
                  ? ` · ${group.role === 'contact' ? 'Contact Point' : 'Legacy access'}`
                  : ''}
              </A>
            )
          })}
        </div>
      )}
      {person.expertiseTags?.length > 0 && (
        <div className="entityCardTags personExpertiseTags" aria-label="Skills and topics">
          {person.expertiseTags.map((tag) =>
            onTagClick ? (
              <button
                key={tag}
                type="button"
                className="chip chip-accent personTagButton"
                onClick={() => onTagClick(tag)}
              >
                <Tag size={13} strokeWidth={1.75} aria-hidden />
                {tag}
              </button>
            ) : (
              <span key={tag} className="chip chip-accent">
                <Tag size={13} strokeWidth={1.75} aria-hidden />
                {tag}
              </span>
            ),
          )}
        </div>
      )}
    </article>
  )
}
