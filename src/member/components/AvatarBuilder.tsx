import { useMemo, useState } from 'react'
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  Heading,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
} from 'react-aria-components'
import { TbArrowBackUp, TbArrowsShuffle, TbPencil } from 'react-icons/tb'
import {
  AVATAR_CHOICES,
  randomAvatar,
  resolveAvatar,
  type AvatarKey,
  type AvatarOptions,
} from '../../shared/avatar'
import { apiPut } from '../lib/api'
import type { AnyValue } from '../lib/types'
import { Avatar } from './MemberAvatar'
import { Tabs } from './Tabs'
import { Button, ErrorCard } from './ui'

const TABS: { id: string; label: string; options: [AvatarKey, string][] }[] = [
  { id: 'head', label: 'Head', options: [['head', 'Hair and headwear']] },
  { id: 'face', label: 'Face', options: [['face', 'Expression']] },
  {
    id: 'extras',
    label: 'Extras',
    options: [
      ['facialHair', 'Facial hair'],
      ['accessories', 'Glasses'],
      ['mask', 'Mask'],
    ],
  },
  {
    id: 'colours',
    label: 'Colours',
    options: [
      ['skinColor', 'Skin tone'],
      ['headContrastColor', 'Hair colour'],
      ['clothingColor', 'Clothing colour'],
    ],
  },
]

// "lovingGrin1" → "Loving grin 1"; colours have no names, so they are numbered
function optionLabel(group: string, value: string, index: number) {
  if (/^[0-9a-f]{6}$/.test(value)) return `${group} ${index + 1}`
  const words = value.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase()
  return words[0].toUpperCase() + words.slice(1)
}

interface OptionGridProps {
  seed: number
  option: AvatarKey
  label: string
  shown: Record<AvatarKey, string>
  onPick: (value: string) => void
}

// every thumbnail is the member's own avatar with that one option swapped in
function OptionGrid({ seed, option, label, shown, onPick }: OptionGridProps) {
  return (
    <div className="grid gap-2">
      <span id={`avatar-${option}`} className="fieldLabel">
        {label}
      </span>
      <ListBox
        aria-labelledby={`avatar-${option}`}
        layout="grid"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[shown[option]]}
        onSelectionChange={(keys) => {
          const [value] = keys === 'all' ? [] : [...keys]
          if (value != null) onPick(String(value))
        }}
        className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 p-1"
      >
        {AVATAR_CHOICES[option].map((value, index) => {
          const text = optionLabel(label, value, index)
          return (
            <ListBoxItem
              key={value}
              id={value}
              textValue={text}
              aria-label={text}
              className="aspect-square cursor-pointer overflow-hidden rounded-card bg-raised outline-offset-2 outline-accent data-[focus-visible]:outline-2 data-[hovered]:bg-accent-tint data-[selected]:bg-accent-tint data-[selected]:outline-2"
            >
              <Avatar
                seed={seed}
                options={{ ...shown, [option]: value }}
                alt=""
                className="block size-full"
              />
            </ListBoxItem>
          )
        })}
      </ListBox>
    </div>
  )
}

interface EditorProps {
  accountId: number
  saved: AvatarOptions | null
  onSaved: () => void
  close: () => void
}

// mounted only while the window is open, so closing without Save discards the picks
function AvatarEditor({ accountId, saved, onSaved, close }: EditorProps) {
  const [picks, setPicks] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // the seed fills whatever is not picked, so every option shows a selection
  const shown = useMemo(() => resolveAvatar(accountId, picks), [accountId, picks])

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await apiPut('/member/profile/avatar', { avatar: picks })
      onSaved()
      close()
    } catch (caught) {
      setError((caught as AnyValue).message)
      setSaving(false)
    }
  }

  return (
    <>
      <div className="grid justify-items-center gap-2 border-b border-line p-4">
        <Heading slot="title" className="m-0 text-base font-semibold">
          Edit avatar
        </Heading>
        <Avatar
          seed={accountId}
          options={picks}
          alt="Preview of your avatar"
          className="size-28 rounded-pill bg-accent-tint sm:size-36"
        />
      </div>

      <Tabs
        label="Avatar options"
        className="px-4 pt-3"
        items={TABS.map(({ id, label, options }) => ({
          id,
          label,
          content: (
            <div className="grid max-h-[36dvh] gap-4 overflow-y-auto pb-4">
              {options.map(([option, name]) => (
                <OptionGrid
                  key={option}
                  seed={accountId}
                  option={option}
                  label={name}
                  shown={shown}
                  onPick={(value) => setPicks({ ...picks, [option]: value })}
                />
              ))}
            </div>
          ),
        }))}
      />

      <footer className="grid gap-3 border-t border-line p-4">
        {error && <ErrorCard message={error} />}
        <div className="flex flex-wrap items-center gap-2">
          <Button className="min-h-11" variant="ghost" onClick={() => setPicks(randomAvatar())}>
            <TbArrowsShuffle size={16} aria-hidden />
            Randomise
          </Button>
          <Button className="min-h-11" variant="ghost" onClick={() => setPicks(null)}>
            <TbArrowBackUp size={16} aria-hidden />
            Reset
          </Button>
          <Button className="ml-auto min-h-11" onClick={close}>
            Cancel
          </Button>
          <Button className="min-h-11" variant="primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </footer>
    </>
  )
}

interface AvatarBuilderProps {
  accountId: number
  /** the picks stored on the profile; null is the seeded default */
  saved: AvatarOptions | null
  onSaved: () => void
}

/** The avatar picker: a floating window on desktop, a bottom sheet on phones. */
export function AvatarBuilder(props: AvatarBuilderProps) {
  return (
    <DialogTrigger>
      <AriaButton className="btn btn-secondary btn-sm">
        <TbPencil size={16} strokeWidth={1.75} aria-hidden />
        Edit avatar
      </AriaButton>
      <ModalOverlay
        isDismissable
        className="fixed inset-0 z-[var(--z-popover)] flex items-end justify-center bg-[var(--overlay)] sm:items-center sm:p-4"
      >
        <Modal className="w-full rounded-t-card bg-card shadow-[var(--shadow-popover)] sm:max-w-xl sm:rounded-card">
          <Dialog className="flex max-h-[92dvh] flex-col overflow-y-auto outline-none">
            {({ close }) => <AvatarEditor {...props} close={close} />}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  )
}
