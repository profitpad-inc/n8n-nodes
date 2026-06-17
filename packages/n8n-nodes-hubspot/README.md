# n8n-nodes-hubspot

This is an n8n community node. It lets you use the **Hubspot API** in your n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
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
    npm install @profitpad-inc/n8n-nodes-hubspot && \
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

The `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` environment variable is required for n8n to load nodes installed outside of its built-in package manager.

### 4. Start n8n

```bash
docker compose up -d
```

The **Hubspot API** node will appear in the node picker after the container starts.

## Operations

### Contact

| Operation | Description |
|-----------|-------------|
| **Get Many** | Retrieve a paginated list of contacts. Supports filtering by ID, keyword, and updated-after date. Fields returned can be restricted to a selected subset or all fields minus exclusions. Enabling **Return All** automatically pages through the full result set. |
| **Get** | Retrieve a single contact by its Hubspot contact ID. |

## Credentials

Authentication uses **Hubspot API** credentials, which require:

- **Base URL** — The root URL of your Hubspot API instance (e.g. `https://api.hubspot.com`).
- **Username** — Your Hubspot API username.
- **Password** — Your Hubspot API password.

The node exchanges these credentials for a short-lived session token on each execution via the `POST /Sessions` endpoint. No token management is required on your end.

To set up credentials in n8n, go to **Credentials → New → Hubspot API** and fill in the fields above.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/installation/)
- [Hubspot API documentation](https://developers.hubspot.com/docs/api-reference/latest/overview)

## Version history

### 0.1.0

Initial release. Supports the **Contact** resource with **Get** and **Get Many** operations.
