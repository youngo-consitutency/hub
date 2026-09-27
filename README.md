# YOUNGO Hub

A shared home for YOUNGO members to find meetings, join working groups, complete onboarding, and organise their work.

[Website](https://youngohub.com) · [Wiki](https://github.com/youngo-consitutency/hub/wiki) · [Contribute](CONTRIBUTING.md) · [Report a bug](https://github.com/youngo-consitutency/hub/issues/new/choose) · [Discussions](https://github.com/youngo-consitutency/hub/discussions)

## What’s here

The Hub brings together membership, working groups, events, opportunities, resources, submissions, and staff tools. What you can see or change depends on your account and responsibilities.

There are two applications in this repository:

| Location                                | What it contains                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Repository root                         | React website, Express server, PostgreSQL database changes, and the root Railway setup          |
| [`hub-v2/`](hub-v2/README.md)           | A separate Next.js and Payload application, with its own setup and tests                        |
| [`mcp-content/`](mcp-content/README.md) | A small service that lets authorised assistants work with Hub content through the website’s API |

The root commands below run the first application. The presence of a feature in this repository does not mean it is enabled on the live website. See [project status](https://github.com/youngo-consitutency/hub/wiki/Project-status).

## Run it locally

Use Node.js 22.13 or later in the Node 22 series, as selected by `.nvmrc`.

```sh
git clone https://github.com/youngo-consitutency/hub.git
cd hub
npm ci
npm run dev-all
```

Open <http://localhost:5173>. The server runs on port `8787`.

You can explore the local site without PostgreSQL. It uses the public sample content and local JSON files. Database features need a local database; use [local development](https://github.com/youngo-consitutency/hub/wiki/Local-development) for the setup.

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
