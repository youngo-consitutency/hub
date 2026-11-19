/** TLS options for Postgres: trusts the CA in DATABASE_CA (PEM) when the host's certificate has a private root. */
export const databaseSsl = () =>
  process.env.DATABASE_CA ? { ca: process.env.DATABASE_CA } : undefined
