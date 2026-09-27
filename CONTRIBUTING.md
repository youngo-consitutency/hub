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
npm run dev-all
```

Use Node.js 22.13 or later in the Node 22 series. See [local development](https://github.com/youngo-consitutency/hub/wiki/Local-development) for database setup and troubleshooting.

Root checks do not cover `hub-v2/`. Use [its setup and checks](hub-v2/README.md) for changes there.

## Make the change

Keep each pull request focused on one problem. Follow the existing components and styles, and avoid adding a dependency for a small task. Keep access checks on the server. Use made-up accounts and public sample data when testing.

For a bug fix, add a test when it helps show the bug stays fixed. For a visual change, check a narrow phone screen, a desktop screen, keyboard use, and readable labels. Attach screenshots without member information.

AI-assisted work is welcome. You are responsible for understanding it, checking its sources, and testing it. Never send private member data or credentials to an assistant.

## Check your work

From the repository root:

```sh
npm run check
git diff --check
```

`check` validates public content, formatting, code quality, types, tests, and the production build. Database tests need `TEST_DATABASE_URL`; some tests also need local material that is not included in a public clone. Mention skipped checks in your pull request.

If formatting fails, run `npm run format`, inspect the diff, and commit only changes that belong to your task. Markdown guides are checked separately; keep their links working.

## Open a pull request

Open a pull request against `main` with the problem, change, and test results. Link the issue when relevant; small fixes do not need one.

Changes to `main` require one approving review, passing checks, and resolved review comments. New commits dismiss previous approvals.

## Docs and public content

Keep short setup and contribution guides with the code. Longer guides live in the [wiki](https://github.com/youngo-consitutency/hub/wiki). Suggest a wiki correction through the documentation issue form; maintainers can apply it to the separate wiki repository.

Public content changes need a reliable source link. Never commit account exports, private meeting links, identity documents, access tokens, or local agent notes.

By contributing, you confirm that you have permission to share your contribution under the applicable project licence. See [LICENSE](LICENSE), [the code of conduct](CODE_OF_CONDUCT.md), and [security reporting](SECURITY.md).
