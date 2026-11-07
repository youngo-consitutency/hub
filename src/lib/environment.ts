// deployment rules in one place

// outbound side effects (email, push, agent keys) stay off on previews, whose
// databases are copies of real members, and anywhere that sets the switch
export const deliveryDisabled = () =>
  process.env.HUB_DELIVERY_DISABLED === 'true' || process.env.VERCEL_ENV === 'preview'

// search engines index only production; self-hosted builds have no VERCEL_ENV
export const isIndexable = () => !process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production'
