# Proposal: add Hub Intelligence workspace

## Why

YOUNGO coordination records are spread across events, submissions, Council decisions, COYs, working groups, directory entries, and role assignments. Members need one evidence-led question interface without centralizing private accounts or messages. YOUNGO Hub is the current YOUNGO member and mission-control product; YMC-v2 is superseded.

## What changes

- Add stable public evidence envelopes over explicitly public Hub records.
- Add authenticated, source-side retrieval for verified members with audience resolution from existing capabilities.
- Add deterministic citation-first synthesis and an evidence inspection UI at `/intelligence`.
- Add an explicit field policy that excludes credentials, sessions, private messages, raw accounts, guardian data, minority data, and other personal fields.
- Audit private queries without copying query text into the general governance audit.
- Add an isolated `save_research_note` writeback. Proposal, independent approval, and application are separate states.
- Add admin metrics and a writeback review queue.

## Non-goals

- No message or account-profile embeddings.
- No autonomous governance or membership mutations.
- No YMC-v2 implementation.
- No claim that extractive synthesis is an authoritative YOUNGO decision.
