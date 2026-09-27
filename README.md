# YOUNGO Hub

A shared home for YOUNGO members to find meetings, join working groups, complete onboarding, and organise their work.

[Website](https://youngohub.com) · [Wiki](https://github.com/youngo-consitutency/hub/wiki) · [Contribute](CONTRIBUTING.md) · [Report a bug](https://github.com/youngo-consitutency/hub/issues/new/choose) · [Discussions](https://github.com/youngo-consitutency/hub/discussions)

## What’s here

The Hub brings together membership, working groups, events, opportunities, resources, submissions, and staff tools. What you can see or change depends on your account and responsibilities.

| Location                                | What it contains                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Repository root                         | One Next.js and Payload application: member interface in `spa/`, staff console at `/console`, PostgreSQL via Payload migrations |
| [`mcp-content/`](mcp-content/README.md) | A small service that lets authorised assistants work with Hub content through the website’s API |

The presence of a feature in this repository does not mean it is enabled on the live website. See [project status](https://github.com/youngo-consitutency/hub/wiki/Project-status).

## Run it locally

Use Node.js 22.13 or later in the Node 22 series, as selected by `.nvmrc`, and a local PostgreSQL database.

```sh
git clone https://github.com/youngo-consitutency/hub.git
cd hub
npm ci
createdb youngo_dev
export DATABASE_URL='postgres://localhost:5432/youngo_dev'
export PAYLOAD_SECRET="$(openssl rand -hex 32)"
npm run migrate
npm run dev
```

Open <http://localhost:3000>. Keep `PAYLOAD_SECRET` stable between local sessions so existing sessions stay valid, and never commit it. See [local development](https://github.com/youngo-consitutency/hub/wiki/Local-development) for troubleshooting.

`npm run seed` reads files from `data/` and creates demo accounts with known passwords. Some input files are not included in a public clone — use it only with a disposable local database.

## Help improve it

Code, clearer wording, accessibility fixes, documentation, and careful bug reports are all welcome. You do not need a Hub account to contribute on GitHub.

1. Read the [contribution guide](CONTRIBUTING.md).
2. Find an issue or discuss a larger idea before starting.
3. Make a focused change in your fork and open a pull request.
4. Run `npm run check` and explain what you tested.

Please follow the [code of conduct](CODE_OF_CONDUCT.md). Report security problems [privately](SECURITY.md), not in public issues.

## Find the right guide

| I want to…                        | Guide                                                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use the Hub                       | [Member guide](https://github.com/youngo-consitutency/hub/wiki/Member-guide)                                                                              |
| Add or correct information        | [Content and publishing](https://github.com/youngo-consitutency/hub/wiki/Content-and-publishing)                                                          |
| Manage membership or staff access | [Staff guide](https://github.com/youngo-consitutency/hub/wiki/Staff-guide)                                                                                |
| Understand the code               | [Code map](https://github.com/youngo-consitutency/hub/wiki/Code-map)                                                                                      |
| Set up or deploy a service        | [Configuration](https://github.com/youngo-consitutency/hub/wiki/Configuration) · [Deployment](https://github.com/youngo-consitutency/hub/wiki/Deployment) |
| Work with an assistant            | [Agent tools](https://github.com/youngo-consitutency/hub/wiki/Agent-tools)                                                                                |
| Maintain this repository          | [Project maintenance](https://github.com/youngo-consitutency/hub/wiki/Project-maintenance)                                                                |

## Licence

See [LICENSE](LICENSE) for the repository’s GPL-3.0 licence. Third-party code and materials keep their own notices. The [project status page](https://github.com/youngo-consitutency/hub/wiki/Project-status) records any unresolved licence labels.
