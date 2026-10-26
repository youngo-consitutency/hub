'use client'

import { useEffect, useRef, useState } from 'react'
import {
  TbBold as Bold,
  TbClearFormatting as Clear,
  TbH2 as Heading,
  TbItalic as Italic,
  TbLink as LinkIcon,
  TbList as List,
  TbListNumbers as ListNumbers,
  TbUnderline as Underline,
} from 'react-icons/tb'
import { Button } from './ui'

const COMMANDS = [
  { command: 'bold', label: 'Bold', Icon: Bold },
  { command: 'italic', label: 'Italic', Icon: Italic },
  { command: 'underline', label: 'Underline', Icon: Underline },
  { command: 'insertUnorderedList', label: 'Bulleted list', Icon: List },
  { command: 'insertOrderedList', label: 'Numbered list', Icon: ListNumbers },
]

/**
 * Minimal rich-text field for member-written email. The server sanitises
 * whatever this produces (src/shared/emailHtml.js), so the toolbar only
 * offers what survives: emphasis, lists, a heading and safe links.
 */
export function HtmlEmailEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (html: string) => void
}) {
  const editor = useRef<HTMLDivElement>(null)
  const [link, setLink] = useState('')

  useEffect(() => {
    const node = editor.current
    if (!node || document.activeElement === node) return
    if ((value || '') !== node.innerHTML) node.innerHTML = value || '<p></p>'
  }, [value])

  const sync = () => onChange(editor.current?.innerHTML || '')
  const run = (command: string, argument?: string) => {
    editor.current?.focus()
    document.execCommand(command, false, argument)
    sync()
  }
  const addLink = () => {
    const href = link.trim()
    if (!/^https:\/\//i.test(href) && !/^mailto:/i.test(href)) return
    run('createLink', href)
    setLink('')
  }

  return (
    <div className="htmlMail">
      <div className="htmlMailToolbar" role="toolbar" aria-label="Email formatting">
        {COMMANDS.map(({ command, label, Icon }) => (
          <Button
            key={command}
            sm
            variant="ghost"
            type="button"
            title={label}
            aria-label={label}
            onClick={() => run(command)}
          >
            <Icon size={16} strokeWidth={1.75} aria-hidden />
          </Button>
        ))}
        <Button
          sm
          variant="ghost"
          type="button"
          title="Heading"
          aria-label="Heading"
          onClick={() => run('formatBlock', 'h2')}
        >
          <Heading size={16} strokeWidth={1.75} aria-hidden />
        </Button>
        <Button
          sm
          variant="ghost"
          type="button"
          title="Clear formatting"
          aria-label="Clear formatting"
          onClick={() => run('removeFormat')}
        >
          <Clear size={16} strokeWidth={1.75} aria-hidden />
        </Button>
        <span className="htmlMailLink">
          <input
            className="input"
            value={link}
            placeholder="https://"
            aria-label="Link address"
            onChange={(event) => setLink(event.target.value)}
          />
          <Button sm variant="ghost" type="button" onClick={addLink} aria-label="Add link">
            <LinkIcon size={16} strokeWidth={1.75} aria-hidden />
          </Button>
        </span>
      </div>
      <div
        ref={editor}
        className="htmlMailBody"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Email message"
        onInput={sync}
        suppressContentEditableWarning
      />
    </div>
  )
}
