# n8n-nodes-eclipse

This is an n8n community node. It lets you use the **Epicor Eclipse API** in your n8n workflows.

Epicor Eclipse is a distribution ERP platform. This node connects to the Eclipse REST API to read and manage data such as contacts within your Eclipse instance.

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
    npm install @profitpad-inc/n8n-nodes-eclipse && \
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

The **Eclipse API** node will appear in the node picker after the container starts.

## Operations

### Contact

| Operation | Description |
|-----------|-------------|
| **Get Many** | Retrieve a paginated list of contacts. Supports filtering by ID, keyword, and updated-after date. Fields returned can be restricted to a selected subset or all fields minus exclusions. Enabling **Return All** automatically pages through the full result set. |
| **Get** | Retrieve a single contact by its Eclipse contact ID. |

## Credentials

Authentication uses **Eclipse API** credentials, which require:

- **Base URL** — The root URL of your Eclipse API instance (e.g. `https://your-instance.epicoreclipse.com`).
- **Username** — Your Eclipse API username.
- **Password** — Your Eclipse API password.

The node exchanges these credentials for a short-lived session token on each execution via the `POST /Sessions` endpoint. No token management is required on your end.

To set up credentials in n8n, go to **Credentials → New → Eclipse API** and fill in the fields above.

## Compatibility

Tested against n8n `1.x`. No known incompatibilities with earlier versions, but `n8nNodesApiVersion: 1` is required (available since n8n `0.187`).

## Usage

### Get Many contacts with field filtering

Use the **Fields to Return** option to reduce payload size:

- **All Fields** — returns every field from each contact (default).
- **Selected Fields** — supply a comma-separated list of field names (e.g. `firstName,lastName,emails`). The `id` field is always included.
- **All Fields Except** — supply a comma-separated list of fields to strip (e.g. `updateKey,sortBy`). The `id` field is never excluded.

### Paginating through all contacts

Enable **Return All** to have the node automatically page through results using the configured **Page Size** until the API returns fewer records than the page size. The **Start Index** option is ignored when **Return All** is enabled.

### Filtering by date

Use the **Updated After** option under **Additional Options** to only retrieve contacts that have been modified since a given timestamp. The Eclipse API always interprets this value as UTC.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/installation/)
- [Epicor Eclipse API documentation](https://epicoreclipse.com)

## Version history

### 0.1.0

Initial release. Supports the **Contact** resource with **Get** and **Get Many** operations.
