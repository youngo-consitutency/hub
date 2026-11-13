import { Button, Input, Label, SearchField } from 'react-aria-components'
import { TbSearch as Search, TbX as Clear } from 'react-icons/tb'

interface PublicSearchProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** the roomy pill used where search leads the page */
  large?: boolean
}

// the search field of the public pages: react-aria gives it the label, clear button and Escape-to-clear
export function PublicSearch({
  label,
  value,
  onChange,
  placeholder = label,
  large,
}: PublicSearchProps) {
  return (
    <SearchField
      className={`sitePublicSearch ${large ? 'sitePublicSearchLarge' : ''}`.trim()}
      value={value}
      onChange={onChange}
    >
      <Label className="srOnly">{label}</Label>
      <Search size={large ? 18 : 16} aria-hidden />
      <Input placeholder={placeholder} />
      <Button className="sitePublicSearchClear" aria-label="Clear search">
        <Clear size={14} aria-hidden />
      </Button>
    </SearchField>
  )
}
