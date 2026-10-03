interface SlideHeadProps {
  slide?: any
}

interface PointsProps {
  points?: any
  variant?: any
}

interface SlideFaceProps {
  slide?: any
}

interface WgSelfPacedProps {
  course?: any
  storageKey?: any
  onReachEnd?: any
}

import { createContext, useContext, useEffect, useState } from 'react'
import { deckStyle, useDocument } from '../lib/documents'
import { TbChevronLeft as ChevronLeft, TbChevronRight as ChevronRight } from 'react-icons/tb'

const ACCENTS = ['#e8943a', '#1f8a3b', '#2f6fed']
const DeckBrand = createContext({})

function readStoredIndex(storageKey: any, length: any) {
  try {
    const saved = Number(sessionStorage.getItem(storageKey) || 0)
    if (!Number.isFinite(saved)) return 0
    return Math.min(Math.max(saved, 0), Math.max(length - 1, 0))
  } catch {
    return 0
  }
}

function initials(label: any) {
  return label
    .split(/\s+/)
    .filter((word: any) => word[0] && /[A-Za-zÀ-ÿ]/.test(word[0]))
    .slice(0, 2)
    .map((word: any) => word[0].toUpperCase())
    .join('')
}

function SlideMark() {
  const brand = useContext(DeckBrand)
  return (
    <div className="jtMark">
      <img src="/brand/youngo-logo.png" alt="YOUNGO" />
      <span>{(brand as any).label}</span>
    </div>
  )
}

function SlideHead({ slide }: SlideHeadProps) {
  return (
    <header className="jtHead">
      <div>
        <h3 id="wg-course-title">{slide.title}</h3>
        <p>{slide.kicker}</p>
      </div>
      <SlideMark />
    </header>
  )
}

function Points({ points, variant }: PointsProps) {
  if (!points?.length) return null
  return (
    <ul className={`jtPoints jtPoints--${variant}`}>
      {points.map((point: any, index: any) => (
        <li key={point.label} style={{ '--jt-bar': ACCENTS[index % ACCENTS.length] } as any}>
          {variant === 'people' ? (
            <span className="jtAvatar" aria-hidden>
              {initials(point.label)}
            </span>
          ) : null}
          <strong>{point.label}</strong>
          <span>{point.text}</span>
        </li>
      ))}
    </ul>
  )
}

function SlideFace({ slide }: SlideFaceProps) {
  const layout = slide.layout || 'prose'
  const lead = slide.body?.[0]
  const rest = slide.body?.slice(1) || []

  if (layout === 'cover') {
    return (
      <div className="jtFace jtFace--cover">
        <SlideMark />
        <div className="jtCoverCopy">
          <p className="jtCoverKicker">{slide.kicker}</p>
          <h3 id="wg-course-title">
            {slide.title.includes('Just Transition') ? (
              <>
                {slide.title.replace(/\s*Just Transition[\s\S]*$/, '')}
                <br />
                {slide.title.match(/Just Transition[\s\S]*$/)?.[0]}
              </>
            ) : (
              slide.title
            )}
          </h3>
          <span className="jtCoverRule" />
          {lead ? <p className="jtCoverBox">{lead}</p> : null}
          {rest.map((line: any) => (
            <p key={line} className="jtCoverNote">
              {line}
            </p>
          ))}
        </div>
      </div>
    )
  }

  if (layout === 'section') {
    return (
      <div className="jtFace jtFace--section">
        <SlideMark />
        <div>
          <p>{slide.kicker}</p>
          <h3 id="wg-course-title">{slide.title}</h3>
          {slide.body?.map((line: any) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`jtFace jtFace--${layout}`}>
      <SlideHead slide={slide} />
      <div className="jtBody">
        {layout === 'split' ? (
          <>
            <div className="jtLeadCard">
              {slide.body?.map((line: any) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <Points points={slide.points?.slice(3)} variant="bars" />
          </>
        ) : null}
        {layout === 'cards' || layout === 'people' ? (
          <>
            {layout === 'cards' && lead ? <p className="jtBanner">{lead}</p> : null}
            {layout === 'people' && slide.body?.length ? (
              <p className="jtQuiet">{slide.body.join(' ')}</p>
            ) : null}
            <Points points={slide.points} variant={layout === 'people' ? 'people' : 'cards'} />
          </>
        ) : null}
        {layout === 'rows' ? (
          <>
            {lead && (slide.points?.length || 0) <= 4 ? <p className="jtBanner">{lead}</p> : null}
            <Points points={slide.points} variant="rows" />
            {slide.links?.length ? (
              <ul className="jtLinks">
                {slide.links.map((link: any) => (
                  <li key={link.href}>
                    <a href={link.href} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
        {layout === 'months' ? (
          <>
            {lead ? <p className="jtBanner">{lead}</p> : null}
            <ol className="jtMonths">
              {slide.months?.map((month: any) => (
                <li key={month.name} className={month.ahead ? 'is-ahead' : undefined}>
                  <time>
                    {month.name}
                    {month.ahead ? ' · ahead' : ''}
                  </time>
                  <span>{month.text}</span>
                </li>
              ))}
            </ol>
          </>
        ) : null}
        {layout === 'prose' ? (
          <div className="jtLeadCard jtLeadCard--wide">
            {slide.body?.map((line: any) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
        {layout === 'split' && slide.points?.length ? (
          <ul className="jtExamples">
            {slide.points.slice(0, 3).map((point: any) => (
              <li key={point.label}>
                <strong>{point.label}</strong>
                <span>{point.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

export function WgSelfPaced({ course, storageKey, onReachEnd }: WgSelfPacedProps) {
  const { doc: deckBrandDoc } = useDocument('wg-deck-brand')
  const WG_DECK_BRAND = deckBrandDoc?.WG_DECK_BRAND || {}
  const slides = course.slides
  const [index, setIndex] = useState(() => readStoredIndex(storageKey, slides.length))
  const slide = slides[index]
  const last = index >= slides.length - 1

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, String(index))
    } catch {
      /* private mode */
    }
    if (last) onReachEnd()
  }, [index, last, onReachEnd, storageKey])

  const go = (next: any) => {
    setIndex(Math.min(slides.length - 1, Math.max(0, next)))
  }

  const brand = { ...WG_DECK_BRAND, ...course.brand }

  return (
    <DeckBrand.Provider value={brand}>
      <div className="jtDeck" style={deckStyle(brand)}>
        <div className="jtDeckFrame">
          <button
            type="button"
            className="jtDeckNav"
            aria-label="Previous slide"
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            <ChevronLeft size={22} strokeWidth={1.75} aria-hidden />
          </button>
          <div
            className="jtStage"
            role="group"
            aria-roledescription="slide"
            aria-labelledby="wg-course-progress wg-course-title"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') go(index + 1)
              if (event.key === 'ArrowLeft') go(index - 1)
            }}
          >
            <SlideFace key={slide.id} slide={slide} />
            <p className="jtPageNum" id="wg-course-progress">
              {String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
            </p>
          </div>
          <button
            type="button"
            className="jtDeckNav"
            aria-label="Next slide"
            disabled={last}
            onClick={() => go(index + 1)}
          >
            <ChevronRight size={22} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="jtDots" role="tablist" aria-label="Onboarding slides">
          {slides.map((item: any, itemIndex: any) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={itemIndex === index}
              aria-label={`${item.title}, slide ${itemIndex + 1}`}
              className={itemIndex === index ? 'is-current' : undefined}
              onClick={() => go(itemIndex)}
            />
          ))}
        </div>
      </div>
    </DeckBrand.Provider>
  )
}
