// Only request the public site's icon, never a resource path or its query string.
export function faviconUrl(value) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      !host.includes('.') ||
      host.includes(':') ||
      /^[\d.]+$/.test(host) ||
      /\.(localhost|local|internal|test|invalid)$/.test(host)
    )
      return null
    return `https://${host}/favicon.ico`
  } catch {
    return null
  }
}
