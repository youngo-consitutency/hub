// error line and save button closing every proposal form
export function ProposalFooter({
  error,
  saving,
  label,
}: {
  error: string
  saving: boolean
  label: string
}) {
  return (
    <>
      {error && (
        <p className="formError" role="alert">
          {error}
        </p>
      )}
      <div className="detailActions detailPageActions">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : label}
        </button>
      </div>
    </>
  )
}
