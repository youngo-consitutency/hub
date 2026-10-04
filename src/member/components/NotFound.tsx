import { TbCompass as Compass } from 'react-icons/tb'
import { A, Empty } from './ui'

export function NotFound() {
  return (
    <Empty
      icon={Compass}
      title="Page not found"
      body="That link doesn’t lead anywhere yet."
      cta={
        <A className="btn btn-secondary" href="/">
          Back home
        </A>
      }
    />
  )
}
