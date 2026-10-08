'use client'

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import {
  TbArrowsMaximize,
  TbCheck,
  TbChevronRight,
  TbLink,
  TbX,
  TbInfoCircle,
} from 'react-icons/tb'
import { A } from './ui'

export interface NotionProperty {
  id?: string
  label: string
  icon: ComponentType<{
    size?: number
    strokeWidth?: number
    className?: string
    'aria-hidden'?: boolean
  }>
  value: ReactNode
}

export interface NotionPeekTab {
  id: string
  label: string
  icon?: ComponentType<{
    size?: number
    strokeWidth?: number
    className?: string
    'aria-hidden'?: boolean
  }>
  badge?: string | number
  content: ReactNode
}

export interface NotionSidePeekProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  eyebrow?: string
  icon?:
    | ComponentType<{
        size?: number
        strokeWidth?: number
        className?: string
        'aria-hidden'?: boolean
      }>
    | ReactNode
  badge?: ReactNode
  fullPageHref?: string
  properties?: NotionProperty[]
  tabs?: NotionPeekTab[]
  initialTab?: string
  actions?: ReactNode
  children?: ReactNode
  className?: string
  copyUrl?: string
}

let openPeeks = 0
let pageOverflow = ''

/**
 * Notion-style Side Peek drawer.
 * Slides out from the right edge with breadcrumbs, full page expand,
 * structured database properties grid, and inner segmented tab menus.
 */
export function NotionSidePeek({
  isOpen,
  onClose,
  title,
  subtitle,
  eyebrow,
  icon: IconProp,
  badge,
  fullPageHref,
  properties = [],
  tabs,
  initialTab,
  actions,
  children,
  className = '',
  copyUrl,
}: NotionSidePeekProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeCallback = useRef(onClose)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [closing, setClosing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<string>(
    initialTab || (tabs && tabs.length > 0 ? tabs[0].id : ''),
  )

  useEffect(() => {
    closeCallback.current = onClose
  }, [onClose])

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (tabs && tabs.length > 0 && (!activeTab || !tabs.some((t) => t.id === activeTab))) {
      setActiveTab(initialTab || tabs[0].id)
    }
  }, [tabs, initialTab, activeTab])

  useEffect(() => {
    if (!isOpen) return

    const dialog = dialogRef.current
    const trigger = document.activeElement
    setClosing(false)
    dialog?.showModal()

    if (openPeeks++ === 0) {
      pageOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }

    return () => {
      dialog?.close()
      if (--openPeeks === 0) {
        document.body.style.overflow = pageOverflow
      }
      requestAnimationFrame(() => {
        if (
          trigger instanceof HTMLElement &&
          trigger.isConnected &&
          document.activeElement === document.body
        ) {
          trigger.focus({ preventScroll: true })
        }
      })
    }
  }, [isOpen])

  useEffect(() => {
    if (!closing) return
    let cancelled = false
    const animations = dialogRef.current?.getAnimations() || []
    if (animations.length === 0) {
      closeCallback.current()
      return
    }
    Promise.allSettled(animations.map((a) => a.finished)).then(() => {
      if (!cancelled) closeCallback.current()
    })
    return () => {
      cancelled = true
    }
  }, [closing])

  const requestClose = () => setClosing(true)

  const handleCopyLink = () => {
    const targetUrl =
      copyUrl ||
      (fullPageHref && typeof window !== 'undefined'
        ? `${window.location.origin}${fullPageHref}`
        : typeof window !== 'undefined'
          ? window.location.href
          : '')
    if (targetUrl && navigator.clipboard) {
      navigator.clipboard
        .writeText(targetUrl)
        .then(() => {
          setCopied(true)
          copiedTimer.current = setTimeout(() => setCopied(false), 2000)
        })
        .catch(() => {})
    }
  }

  if (!isOpen) return null

  const renderIcon = () => {
    if (!IconProp) return null
    if (typeof IconProp === 'function') {
      const IconComponent = IconProp as ComponentType<{
        size?: number
        strokeWidth?: number
        'aria-hidden'?: boolean
      }>
      return <IconComponent size={24} strokeWidth={1.75} aria-hidden />
    }
    return IconProp
  }

  const currentTabContent = tabs?.find((t) => t.id === activeTab)?.content ?? children

  return (
    <dialog
      ref={dialogRef}
      className={`routePeek notionSidePeek ${className}`.trim()}
      aria-label={title}
      data-closing={closing || undefined}
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      {/* Top action bar with breadcrumbs and view controls */}
      <div className="routePeekToolbar notionPeekTopBar">
        <div className="notionPeekBreadcrumb">
          {eyebrow ? (
            <span className="notionPeekBreadcrumbText">
              {eyebrow.split('›').map((part, index) => (
                <span key={index} className="notionBreadcrumbItem">
                  {index > 0 && (
                    <TbChevronRight size={13} className="notionBreadcrumbSep" aria-hidden />
                  )}
                  <span>{part.trim()}</span>
                </span>
              ))}
            </span>
          ) : (
            <span className="notionPeekBreadcrumbText">Details</span>
          )}
        </div>

        <div className="notionPeekTopActions">
          <button
            type="button"
            className="btn btn-ghost btn-sm notionTopActionBtn"
            title="Copy shareable link"
            onClick={handleCopyLink}
            aria-label="Copy link"
          >
            {copied ? (
              <>
                <TbCheck size={15} strokeWidth={2} className="textSuccess" aria-hidden />
                <span className="notionActionLabel">Copied</span>
              </>
            ) : (
              <>
                <TbLink size={15} strokeWidth={1.75} aria-hidden />
                <span className="notionActionLabel">Copy link</span>
              </>
            )}
          </button>

          {fullPageHref && (
            <A
              href={fullPageHref}
              className="btn btn-ghost btn-sm notionTopActionBtn"
              title="Open as full standalone page"
              aria-label="Open as full page"
              peek={false}
            >
              <TbArrowsMaximize size={15} strokeWidth={1.75} aria-hidden />
              <span className="notionActionLabel">Open full page</span>
            </A>
          )}

          <button
            type="button"
            className="iconButton notionPeekCloseBtn"
            aria-label={`Close ${title}`}
            onClick={requestClose}
            title="Close (Esc)"
          >
            <TbX size={18} strokeWidth={1.8} aria-hidden />
          </button>
        </div>
      </div>

      {/* Main scrolling peek body */}
      <div className="routePeekBody notionPeekBody">
        {/* Cover / Header section */}
        <header className="notionPeekHeader">
          <div className="notionPeekIconTitleRow">
            {IconProp && <div className="notionPeekIconBadge">{renderIcon()}</div>}
            <div className="notionPeekHeadingText">
              <div className="notionPeekBadgesRow">{badge}</div>
              <h2 className="notionPeekTitle">{title}</h2>
              {subtitle && <div className="notionPeekSubtitle">{subtitle}</div>}
            </div>
          </div>
        </header>

        {/* Notion-style Properties Block */}
        {properties && properties.length > 0 && (
          <div className="notionPropertiesBlock" aria-label="Properties">
            {properties.map((prop, idx) => {
              const PropIcon = prop.icon
              return (
                <div key={prop.id || idx} className="notionPropertyRow">
                  <div className="notionPropertyLabel">
                    <PropIcon size={15} strokeWidth={1.75} className="notionPropIcon" aria-hidden />
                    <span>{prop.label}</span>
                  </div>
                  <div className="notionPropertyValue">{prop.value}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Quick action bar */}
        {actions && <div className="notionPeekQuickActions">{actions}</div>}

        {/* Inner Menus / Segmented Tabs */}
        {tabs && tabs.length > 1 && (
          <nav className="notionPeekTabs" role="tablist" aria-label="Inner navigation">
            {tabs.map((tab) => {
              const TabIcon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`notionPeekTab ${isActive ? 'isActive' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-selected={isActive}
                  aria-controls={`peek-panel-${tab.id}`}
                  id={`peek-tab-${tab.id}`}
                  role="tab"
                >
                  {TabIcon && <TabIcon size={16} strokeWidth={1.75} aria-hidden />}
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && <span className="notionTabBadge">{tab.badge}</span>}
                </button>
              )
            })}
          </nav>
        )}

        {/* Content area */}
        <section
          className="notionPeekContentArea"
          role={tabs && tabs.length > 1 ? 'tabpanel' : undefined}
          id={tabs && tabs.length > 1 ? `peek-panel-${activeTab}` : undefined}
          aria-labelledby={tabs && tabs.length > 1 ? `peek-tab-${activeTab}` : undefined}
        >
          {currentTabContent}
        </section>
      </div>
    </dialog>
  )
}

/**
 * Notion-style Callout box with distinct icon gutter and soft backdrop.
 */
export function NotionCallout({
  icon: Icon = TbInfoCircle,
  tone = 'default',
  children,
  className = '',
}: {
  icon?: ComponentType<{
    size?: number
    strokeWidth?: number
    className?: string
    'aria-hidden'?: boolean
  }>
  tone?: 'default' | 'accent' | 'warn' | 'success'
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`notionCallout notionCallout-${tone} ${className}`.trim()}>
      <div className="notionCalloutIcon" aria-hidden>
        <Icon size={18} strokeWidth={1.75} />
      </div>
      <div className="notionCalloutBody">{children}</div>
    </div>
  )
}
