/**
 * Connection options for Postgres that trust the CA in DATABASE_CA (PEM), for a host whose
 * certificate has a private root (Supabase).
 *
 * node-postgres lets any ssl setting in the connection string replace the `ssl` option, so
 * `?sslmode=require` silently discards the pinned CA and the handshake fails with "self-signed
 * certificate in certificate chain" (and `sslmode=disable` would turn TLS off). When a CA is set
 * the ssl* parameters are therefore removed from the URL and TLS is configured here, with
 * verification left on. With no CA the URL is used untouched.
 */
export function databaseConnection(
  url: string = process.env.DATABASE_URL || '',
  ca: string | undefined = process.env.DATABASE_CA,
): { connectionString: string; ssl?: { ca: string } } {
  if (!ca || !url) return { connectionString: url }
  const at = url.indexOf('?')
  if (at === -1) return { connectionString: url, ssl: { ca } }
  const params = new URLSearchParams(url.slice(at + 1))
  for (const key of [...params.keys()]) if (/^(ssl|uselibpqcompat$)/i.test(key)) params.delete(key)
  const rest = params.toString()
  return { connectionString: rest ? `${url.slice(0, at)}?${rest}` : url.slice(0, at), ssl: { ca } }
}
