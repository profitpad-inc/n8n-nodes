# n8n-nodes

Monorepo containing n8n community node packages maintained by [ProfitPad](https://github.com/profitpad-inc).

## Packages

| Package | Description |
|---------|-------------|
| [`@profitpad-inc/n8n-nodes-eclipse`](packages/n8n-nodes-eclipse) | n8n node for the Epicor Eclipse API |
| [`@profitpad-inc/n8n-nodes-friendgrid`](packages/n8n-nodes-friendgrid) | n8n node for FriendGrid |

## Development

This repo uses npm workspaces. Install dependencies from the root:

```bash
npm install
```

Build all packages:

```bash
npm run build
```

Lint all packages:

```bash
npm run lint
```

To work on a specific package, navigate to its directory and use the `n8n-node` CLI:

```bash
cd packages/n8n-nodes-eclipse
npm run dev       # start dev mode
npm run build     # compile TypeScript
npm run lint      # lint
npm run lint:fix  # lint and auto-fix
npm publish       # to publish
```

## Publishing

Packages are published to the GitHub Package Registry (`https://npm.pkg.github.com`) under the `@profitpad-inc` scope. Publishing is handled automatically via the CI/CD workflow on tagged releases.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/installation/)
- [Building community nodes](https://docs.n8n.io/integrations/creating-nodes/overview/)
