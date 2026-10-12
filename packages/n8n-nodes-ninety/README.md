# n8n-nodes-ninety

This is an n8n community node. It lets you use the **Ninety public API** in your n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Resources](#resources)
[Version history](#version-history)


## Installation

This package is published to the **GitHub Package Registry** (not the public npm registry), so it cannot be installed through the n8n UI's community node installer. Instead, build a custom Docker image that pre-installs the node.

### Prerequisites

Create a GitHub [Personal Access Token (PAT)](https://github.com/settings/tokens) with the `read:packages` scope. This token only needs read access and is used at image build time.

### 1. Create a Dockerfile

```dockerfile
FROM n8nio/n8n:latest

ARG GITHUB_TOKEN

USER root

RUN mkdir -p /home/node/.n8n/nodes && \
    printf "@profitpad-inc:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\n" "${GITHUB_TOKEN}" \
      > /home/node/.n8n/nodes/.npmrc && \
    cd /home/node/.n8n/nodes && \
    npm install @profitpad-inc/n8n-nodes-ninety && \
    rm /home/node/.n8n/nodes/.npmrc && \
    chown -R node:node /home/node/.n8n

USER node
```

The `.npmrc` file is removed after install so the token is not left on disk in the final image.

### 2. Build the image

```bash
docker build --build-arg GITHUB_TOKEN=ghp_yourtoken -t my-n8n .
```

### 3. docker-compose.yml

```yaml
services:
  n8n:
    image: my-n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
```

### 4. Start n8n

```bash
docker compose up -d
```

The **Ninety** node will appear in the node picker after the container starts.

## Operations

### Scorecard

| Operation | Endpoint | Description |
|-----------|----------|-------------|
| **Get Team Scorecard** | `GET /v1/scorecard/team-scorecard` | Read a Team's Scorecard (its Measurables and their scores) for one period interval. Optional **Window** or **Date**. **Output** returns the whole Scorecard as one item, one item per Measurable, or one item per Measurable per period. |
| **Create or Update Score** | `POST /v1/scorecard/kpis/{kpiId}/scores` | Set a Measurable's score for one period. An existing score for that period is overwritten. |
| **Clear Score** | `DELETE /v1/scorecard/kpis/{kpiId}/scores/{periodStartDate}` | Clear a Measurable's score for one period. |

The **Team** and **Measurable** fields are dropdowns loaded from your Ninety account, and both accept an ID through an expression. On **Create or Update Score** and **Clear Score**, pick a **Team** and **Period Interval** first to narrow the Measurable list (leave Team empty to list every Team's Measurables).

## Credentials

Authentication uses **Ninety API** credentials:

- **Credential Notes** (optional): free text, never sent.
- **Personal Access Token**: generate one in Ninety at **Settings → Developer Settings** (`https://app.ninety.io/settings/user/developer-settings`).

The token is sent as `Authorization: Bearer <token>`. The credential test calls `GET /v1/teams`.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/installation/)
- [Ninety public API (Swagger)](https://api.public.ninety.io/v1/swagger)

## Version history

### 0.1.0

Initial release. **Scorecard** resource with **Get Team Scorecard**, **Create or Update Score**, and **Clear Score**.
