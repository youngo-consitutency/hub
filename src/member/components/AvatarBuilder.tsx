import { useMemo, useState } from 'react'
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import { TbArrowBackUp, TbArrowsShuffle } from 'react-icons/tb'
import {
  AVATAR_CHOICES,
  avatarDataUri,
  randomAvatar,
  resolveAvatar,
  type AvatarKey,
  type AvatarOptions,
} from '../../shared/avatar'
import { apiPut } from '../lib/api'
import type { AnyValue } from '../lib/types'
import { SearchableSelect } from './FormControls'
import { Button, ErrorCard } from './ui'

const PARTS: [AvatarKey, string][] = [
  ['head', 'Hair and headwear'],
  ['face', 'Expression'],
  ['facialHair', 'Facial hair'],
  ['accessories', 'Glasses'],
  ['mask', 'Mask'],
]

const COLOURS: [AvatarKey, string][] = [
  ['skinColor', 'Skin tone'],
  ['headContrastColor', 'Hair colour'],
  ['clothingColor', 'Clothing colour'],
]

// "lovingGrin1" → "Loving grin 1"
function optionLabel(value: string) {
  const words = value.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase()
  return words[0].toUpperCase() + words.slice(1)
}

const PART_OPTIONS = Object.fromEntries(
  PARTS.map(([key]) => [
    key,
    AVATAR_CHOICES[key].map((value) => ({ value, label: optionLabel(value) })),
  ]),
)

interface AvatarBuilderProps {
  accountId: number
  /** the picks stored on the profile when the editor opened; null is the seeded default */
  saved: AvatarOptions | null
  onSaved: () => void
}

export function AvatarBuilder({ accountId, saved, onSaved }: AvatarBuilderProps) {
  const [picks, setPicks] = useState(saved)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // the seed fills whatever is not picked, so the controls always show a value
  const shown = useMemo(() => resolveAvatar(accountId, picks), [accountId, picks])
  const preview = useMemo(() => avatarDataUri(accountId, picks), [accountId, picks])

  const change = (next: AvatarOptions | null) => {
    setPicks(next)
    setDirty(true)
    setMessage('')
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await apiPut('/member/profile/avatar', { avatar: picks })
      setDirty(false)
      setMessage('Avatar saved.')
      onSaved()
    } catch (caught) {
      setError((caught as AnyValue).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <fieldset className="m-0 grid min-w-0 gap-5 border-0 border-t border-line p-0 pt-5 sm:grid-cols-[auto_minmax(0,1fr)]">
      <legend className="sr-only">Avatar</legend>
      <div className="grid content-start justify-items-center gap-3">
        <img
          src={preview}
          alt="Preview of your avatar"
          className="size-36 rounded-pill bg-accent-tint"
        />
        <div className="flex flex-wrap justify-center gap-2">
          <Button className="min-h-11" onClick={() => change(randomAvatar())}>
            <TbArrowsShuffle size={16} aria-hidden />
            Randomise
          </Button>
          <Button className="min-h-11" variant="ghost" onClick={() => change(null)}>
            <TbArrowBackUp size={16} aria-hidden />
            Reset
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 gap-4">
        <div>
          <p className="pageEyebrow">Avatar</p>
          <p className="meta">
            Build the avatar other members see next to your name. Reset returns to the one the Hub
            drew for you.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {PARTS.map(([key, label]) => (
            <SearchableSelect
              key={key}
              label={label}
              options={PART_OPTIONS[key]}
              value={shown[key]}
              onChange={(value) => change({ ...picks, [key]: value })}
            />
          ))}
        </div>
        {COLOURS.map(([key, label]) => (
          <div key={key} className="grid gap-2">
            <span id={`avatar-${key}`} className="fieldLabel">
              {label}
            </span>
            <ToggleButtonGroup
              aria-labelledby={`avatar-${key}`}
              className="flex flex-wrap gap-2"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[shown[key]]}
              onSelectionChange={(keys) => change({ ...picks, [key]: String([...keys][0]) })}
            >
              {AVATAR_CHOICES[key].map((colour, index) => (
                <ToggleButton
                  key={colour}
                  id={colour}
                  aria-label={`${label} ${index + 1}`}
                  className="size-11 cursor-pointer rounded-pill border border-line-strong p-0 outline-offset-2 outline-accent data-focus-visible:outline-2 data-selected:outline-2"
                  style={{ backgroundColor: `#${colour}` }}
                />
              ))}
            </ToggleButtonGroup>
          </div>
        ))}
        {error && <ErrorCard message={error} />}
        <div className="flex flex-wrap items-center gap-3">
          <Button className="min-h-11" variant="primary" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save avatar'}
          </Button>
          <p className="meta" role="status">
            {message}
          </p>
        </div>
      </div>
    </fieldset>
  )
}
