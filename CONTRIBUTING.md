# Contributing to YOUNGO Hub

Thanks for helping. Small fixes, clearer docs, translations, accessibility work, and thoughtful reports are useful contributions.

## Choose a task

Check [open issues](https://github.com/youngo-consitutency/hub/issues) first. `good first issue` means a maintainer has checked that a task is suitable for a newcomer; `help wanted` means outside help is welcome. These labels may not always have open tasks.

Use [Discussions](https://github.com/youngo-consitutency/hub/discussions) for questions and early ideas. Open an issue for a specific bug or agreed change. For a large change, agree on the scope before writing code.

## Set up

Fork the repository, clone your fork, and create a branch:

```sh
git clone https://github.com/YOUR-USERNAME/hub.git
cd hub
git switch -c fix/short-description
npm ci
npm run dev
```

Use Node.js 22.13 or later in the Node 22 series. The app needs `DATABASE_URL` and `PAYLOAD_SECRET`; see [local development](https://github.com/youngo-consitutency/hub/wiki/Local-development) for database setup and troubleshooting.

## Make the change

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

If formatting fails, run `npm run format`, inspect the diff, and commit only changes that belong to your task. Markdown guides are checked separately; keep their links working.

## Open a pull request

Push your branch to your fork and open a pull request against `main`. Explain the problem, the change, and what you tested. Link the issue if there is one. A small fix does not need a separate issue first.

Changes to `main` need one approving review, passing checks, and resolved review conversations. New commits can require a fresh review. Maintainers may ask for a smaller change or more evidence. A merged change is not automatically proof of a live deployment.

## Docs and public content

Keep short setup and contribution guides with the code. Longer guides live in the [wiki](https://github.com/youngo-consitutency/hub/wiki). Suggest a wiki correction through the documentation issue form; maintainers can apply it to the separate wiki repository.

Public content changes need a reliable source link. Never commit account exports, private meeting links, identity documents, access tokens, or local agent notes.

By contributing, you confirm that you have permission to share your contribution under the applicable project licence. See [LICENSE](LICENSE), [the code of conduct](CODE_OF_CONDUCT.md), and [security reporting](SECURITY.md).
