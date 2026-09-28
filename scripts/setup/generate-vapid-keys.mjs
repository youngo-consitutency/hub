/**
 * Generate VAPID keys for Web Push
 * Run with: npm run setup:push
 */
// web-push is CommonJS — it has no named ESM exports, so take the default.
import webPush from 'web-push'

const keys = webPush.generateVAPIDKeys()

console.log('VAPID Keys Generated:')
console.log('=====================')
console.log('')
console.log('Public Key (add to .env as VAPID_PUBLIC_KEY):')
console.log(keys.publicKey)
console.log('')
console.log('Private Key (add to .env as VAPID_PRIVATE_KEY):')
console.log(keys.privateKey)
console.log('')
console.log('Subject (add to .env as VAPID_SUBJECT):')
console.log(
  process.env.VAPID_SUBJECT ||
    (process.env.EMAIL_FROM
      ? `mailto:${process.env.EMAIL_FROM}`
      : 'mailto:<your-hub-admin-email>'),
)
console.log('')
console.log('Add these to your deployment environment variables.')
