# Contributing to YOUNGO Hub

## Choose a task

Look for `good first issue` or `help wanted` in [open issues](https://github.com/youngo-consitutency/hub/issues).

Use [issues](https://github.com/youngo-consitutency/hub/issues/new/choose) for bugs, proposals, and documentation corrections. Agree on the scope of larger changes before starting.

## Set up

Work on a branch in your fork:

```sh
git clone https://github.com/YOUR-USERNAME/hub.git
cd hub
git switch -c fix/short-description
npm ci
npm run dev
```

Use Node.js 22.13 or later in the Node 22 series. The app needs `DATABASE_URL` and `PAYLOAD_SECRET`; see [local development](https://github.com/youngo-consitutency/hub/wiki/Local-development) for database setup and troubleshooting.

## Make the change

Use British English for documentation, interface copy, and comments. Keep API names, identifiers, official titles, and quotations unchanged.

Keep each pull request focused on one problem. Follow the existing components and styles, and avoid adding a dependency for a small task. Keep access checks on the server. Use made-up accounts and public sample data when testing.

For a bug fix, add a test when it helps show the bug stays fixed. For a visual change, check a narrow phone screen, a desktop screen, keyboard use, and readable labels. Attach screenshots without member information.

AI-assisted work is welcome. You are responsible for understanding it, checking its sources, and testing it. Never send private member data or credentials to an assistant.

## Check your work

From the repository root:

```sh
npm run lint
npm run build
git diff --check
```

The build runs TypeScript checking. `npm run test:int` and `npm run test:e2e` need a running server and seeded demo accounts — mention skipped checks in your pull request.

Format only files changed by your task, inspect the diff, and keep documentation links working.

## Open a pull request

Open a pull request against `main` with the problem, change, and test results. Link the issue when relevant; small fixes do not need one.

Changes to `main` require a pull request, passing checks, and resolved review comments. The normal rule also requires one approval and a branch that is up to date with `main`. Only `unnobatroo` can bypass the approval and branch-update requirements when merging a pull request. Passing checks and branch protections still apply.

## Docs and public content

Keep short setup and contribution guides with the code. The [organisation and permissions guide](https://github.com/youngo-consitutency/hub/wiki/Organisation-and-permissions) describes the proposed access model. Longer guides live in the [wiki](https://github.com/youngo-consitutency/hub/wiki). Suggest a wiki correction through the documentation issue form; maintainers can apply it to the separate wiki repository.

Public content changes need a reliable source link. Never commit account exports, private meeting links, identity documents, access tokens, or local agent notes.

By contributing, you confirm that you have permission to share your contribution under the applicable project licence. See [LICENSE](LICENSE), [the code of conduct](CODE_OF_CONDUCT.md), and [security reporting](SECURITY.md).
