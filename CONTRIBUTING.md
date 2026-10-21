# Contributing to Living Code

Choose the repository that owns the change:

- **New application port:** follow [Creating and contributing a port](docs/PORT-AUTHORING.md), then the
  [metadata/README contract](docs/PORTS.md). The scaffold creates documentation, not an application implementation.
- **Existing application port:** open its issue form or pull request in that port's repository. Follow its
  `CONTRIBUTING.md` for local generation, native-format tests, packaging and screenshots.
- **Palette or shared semantic roles:** propose the change in core. Follow [Palette rollouts](docs/PALETTE-ROLLOUTS.md)
  to regenerate and review adopting ports without taking over their generators.
- **Website presentation:** contribute to [landing](https://github.com/living-code-theme/landing), not a port's README
  renderer or a core application generator.
- **Discovery, scaffolding or maintainer tooling:** contribute here. Run `pnpm install --frozen-lockfile`,
  `pnpm check` and `pnpm test` with Node 22.22+ and pnpm 12.9.0.

If you cannot create repositories in the organization, use the
[port-request form](https://github.com/living-code-theme/core/issues/new?template=port-request.yml) to propose an app
and link your prototype repository or patch. Maintainers review and arrange the organization repository; creating a
repository under your own account does not automatically publish it on living-code.dev.

Keep README as each port's only authored installation/configuration guide. Do not edit generated website documents,
register routes in landing, automatically adopt palette changes during builds, or replace real captures with mockups.
Marketplace accounts, release tags and publication remain explicit maintainer operations.
