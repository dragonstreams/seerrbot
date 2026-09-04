# ReelRelay

ReelRelay is a self-hosted Discord bot and web dashboard for submitting movie and TV requests to [Seerr](https://github.com/seerr-team/seerr). It signs in using a Seerr username and password, so a Seerr API key is not required.

When someone uses `/seerr`, ReelRelay:

1. searches Seerr and displays matching titles through Discord autocomplete;
2. checks whether the selected title is already available;
3. replies `This Item is already available` if Seerr reports it as available;
4. otherwise shows the poster and asks the user to confirm;
5. submits the confirmed request to Seerr; and
6. checks Seerr every two minutes, notifying the requester when the title becomes available.

## Features

- Discord `/seerr` command for movies and TV series
- Search autocomplete and poster previews
- Availability checks before confirmation and immediately before submission
- Confirmation button to prevent accidental requests
- Automatic Seerr fulfillment polling
- Notification in the original Discord channel, with DM fallback
- Web dashboard for setup, connection tests, request history, and manual polling
- Encrypted local storage for credentials and tracked requests
- Docker image and GitHub Actions workflow for production deployment
- Bunny.net Magic Containers support

## Requirements

Before installing ReelRelay, you need:

- a running Seerr instance reachable from the ReelRelay server over HTTPS;
- a Seerr local username/email and password that can create requests;
- a Discord account with permission to add applications to the target server;
- a publicly reachable HTTPS URL for production Discord interactions;
- Node.js 22 and npm for a source installation, **or** Docker for a container installation.

> ReelRelay uses Seerr's username/password login endpoint. An account that can only sign in through an external identity provider may not work unless it also has local credentials.

## 1. Fork and clone the repository

1. Select **Fork** on GitHub and create a fork under your account or organization.
2. Clone your fork:

   ```bash
   git clone https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
   cd YOUR-REPOSITORY
   ```

3. Keep the default branch named `main` or `master` if you want the included container workflow to publish the `latest` image tag automatically.

## 2. Create the Discord application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select **New Application**, give it a name, and create it.
3. On **General Information**, copy:
   - **Application ID**
   - **Public Key**
4. Open **Bot**, create the bot if needed, and select **Reset Token** to obtain the **Bot Token**.
5. Store the bot token securely. Do not commit it to Git or expose it in browser-side code.
6. In Discord, enable **Developer Mode** under **User Settings → Advanced**. Right-click the server where the bot will run, select **Copy Server ID**, and save the value.

No privileged gateway intents are required. ReelRelay receives commands over Discord's HTTP interactions endpoint rather than a persistent gateway connection.

## 3. Install ReelRelay

Choose either a local source installation or a Docker deployment.

### Option A: Run from source

Install dependencies:

```bash
npm install --legacy-peer-deps
```

Start the development server:

```bash
npm run dev
```

For a production source build:

```bash
npm run build
npm start
```

By default, local configuration is stored in `.data/`. To use another persistent directory, set `REELRELAY_DATA_DIR` before starting the app.

The following scripts are available:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create the Nitro production build |
| `npm start` | Start the built production server |
| `npm run lint` | Run ESLint |

### Option B: Run with Docker

Build the image from the repository:

```bash
docker build -t reelrelay .
```

Create a persistent volume and start the container:

```bash
docker volume create reelrelay-data

docker run -d \
  --name reelrelay \
  --restart unless-stopped \
  -p 8080:8080 \
  -e REELRELAY_DATA_DIR=/data \
  -v reelrelay-data:/data \
  reelrelay
```

Open `http://localhost:8080`. For Discord integration, place the service behind a reverse proxy or hosting platform that provides a public HTTPS URL.

The container:

- listens on `0.0.0.0:8080`;
- runs the application as a non-root user after preparing the data directory;
- exposes `GET /api/health` for health checks; and
- stores encrypted configuration and request history under `/data`.

## 4. Complete the ReelRelay setup page

Open the deployed ReelRelay URL and enter the following values.

### Seerr settings

| Field | Value |
| --- | --- |
| Seerr URL | The public or internally reachable HTTPS base URL of your Seerr instance, without an API path |
| Username or email | The Seerr account used to submit requests |
| Password | The password for that Seerr account |

### Discord settings

| Field | Value |
| --- | --- |
| Application ID | From Discord Developer Portal → General Information |
| Server ID | The Discord server ID copied with Developer Mode enabled |
| Public Key | From Discord Developer Portal → General Information |
| Bot Token | From Discord Developer Portal → Bot |

A Server ID is recommended because server-specific slash commands update almost immediately. If it is omitted, ReelRelay registers a global command, which can take longer to appear.

### Dashboard secret

Choose a unique secret of at least eight characters. It protects configuration changes, connection tests, command publishing, and manual status checks. Keep it in a password manager.

Select **Save setup** before configuring Discord's interactions endpoint. ReelRelay must already have the Discord public key saved when Discord verifies the endpoint.

## 5. Connect Discord

After saving the setup:

1. On the ReelRelay setup page, select **Invite bot**.
2. Choose the Discord server and authorize the bot. The generated invite requests the `bot` and `applications.commands` scopes with the permissions needed to send messages and use slash commands.
3. Select **Test connection** to verify the bot token and confirm that the bot can access the configured server.
4. In Discord Developer Portal, open the application and go to **General Information**.
5. Set **Interactions Endpoint URL** to:

   ```text
   https://YOUR-PUBLIC-HOST/api/bot/interactions
   ```

6. Save the endpoint and wait for Discord's verification to succeed.
7. Return to ReelRelay and select **Publish /seerr**.

The public hostname must use HTTPS and must be reachable by Discord. A local development server requires a secure public tunnel if you want to test live Discord interactions.

## 6. Test the request flow

In the configured Discord server:

1. Enter `/seerr`.
2. Choose **Movie** or **TV series** and begin typing a title.
3. Select a result from autocomplete.
4. If Seerr already reports the title as available, ReelRelay responds with `This Item is already available` and does not submit a request.
5. Otherwise, verify the poster and select **Confirm request**.
6. Confirm that the request appears in Seerr and on the ReelRelay dashboard.

ReelRelay checks recent requests every two minutes. When Seerr marks a tracked request as available, the bot attempts to notify the user in the original channel. If channel delivery fails, it attempts a direct message. The dashboard records failed notification attempts.

## Deploying from GitHub Container Registry

The included `.github/workflows/container.yml` workflow builds a `linux/amd64` image on pushes to `main` or `master`, on version tags beginning with `v`, and through manual workflow dispatch.

It publishes:

- `ghcr.io/OWNER/REPOSITORY:latest` for the default branch;
- `ghcr.io/OWNER/REPOSITORY:sha-COMMIT` for immutable deployments; and
- `ghcr.io/OWNER/REPOSITORY:vX.Y.Z` for Git version tags.

After forking:

1. Open the fork's **Actions** tab and enable workflows if GitHub asks.
2. Push to the default branch or manually run **Build ReelRelay container**.
3. Open the package linked to the completed workflow.
4. Make the package public, or configure your host with a GitHub token that has `read:packages` permission.
5. Deploy `ghcr.io/YOUR-USERNAME/YOUR-REPOSITORY:latest`.
6. Mount persistent storage at `/data` and set `REELRELAY_DATA_DIR=/data`.

If the package is private, do not place the registry token in the application image. Store it in the hosting provider's private container-registry credentials.

## Bunny.net Magic Containers

Use these settings when creating the Magic Container application:

| Setting | Value |
| --- | --- |
| Image | `ghcr.io/OWNER/REPOSITORY:latest` |
| Container port | `8080` |
| Environment variable | `REELRELAY_DATA_DIR=/data` |
| Persistent volume mount | `/data` |
| Startup health check | HTTP GET `/api/health` on port `8080` |
| Readiness health check | HTTP GET `/api/health` on port `8080` |
| Liveness health check | HTTP GET `/api/health` on port `8080` |
| Minimum instances | `1` |
| Maximum instances | `1` |

Keep the application at exactly one instance. ReelRelay uses an encrypted file store on a single persistent volume and does not support concurrent replicas sharing that store.

Without the `/data` volume, credentials and request history are lost whenever Bunny replaces or restarts the container.

### Bunny deployment steps

1. Wait for the **Build ReelRelay container** GitHub Actions workflow to complete.
2. Make the GHCR package public or add GHCR as a private registry in Bunny.
3. Create a Magic Containers application using the image from your fork.
4. Apply the port, volume, health check, environment, and instance settings from the table above.
5. Deploy and open the Bunny-provided public hostname.
6. Complete the ReelRelay setup page.
7. Configure Discord's interactions endpoint using the Bunny hostname.
8. Invite the bot, test the connection, and publish `/seerr`.

## Configuration and persistent data

ReelRelay currently supports one Discord/Seerr configuration per deployment.

### Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `REELRELAY_DATA_DIR` | `.data` outside Docker, `/data` in the image | Directory containing encrypted configuration and request tracking data |
| `PORT` / `NITRO_PORT` | `8080` in the image | HTTP port for the production Nitro server |
| `HOST` / `NITRO_HOST` | `0.0.0.0` in the image | Production server bind address |

Seerr and Discord credentials are entered through the setup page rather than environment variables.

### Stored files

ReelRelay writes two files in `REELRELAY_DATA_DIR`:

- `reelrelay.enc` — encrypted configuration and tracked requests;
- `reelrelay.key` — the local encryption seed used to decrypt the store.

Back up and restore both files together. The encrypted store cannot be recovered without its matching key file. Never commit either file to Git; `.data/` is ignored by the repository.

## Updating a forked deployment

1. Pull or merge the desired changes into your fork.
2. Push the updated default branch so GitHub Actions publishes a new `latest` image, or create a version tag.
3. Redeploy the new image while keeping the existing `/data` volume attached.
4. Confirm that `/api/health` responds successfully and test a Discord request.

For predictable rollbacks, deploy an immutable `sha-COMMIT` or version tag rather than `latest`.

## Troubleshooting

### Discord rejects the interactions endpoint

- Confirm the URL is public, uses HTTPS, and ends with `/api/bot/interactions`.
- Save the ReelRelay setup before asking Discord to verify the endpoint.
- Confirm that the Application ID and Public Key belong to the same Discord application.
- Check that your reverse proxy forwards POST requests and does not alter the request body; Discord signatures are verified against the exact raw body.

### `/seerr` does not appear

- Confirm the bot has been invited to the configured server.
- Use **Test connection**, then **Publish /seerr** again.
- Verify that the Server ID is correct. Server commands normally appear quickly; global commands can take longer.

### Seerr login fails

- Verify the Seerr URL uses HTTPS and does not include `/api/v1`.
- Confirm the account can sign in to Seerr with a username/email and password.
- Confirm ReelRelay's host can reach the Seerr URL.
- Make sure the account is allowed to request the selected media type.

### Requests work but notifications fail

- Ensure the bot can view the original channel and send messages there.
- If channel delivery is unavailable, ensure the user permits direct messages from server members.
- Review the ReelRelay dashboard for the recorded Discord error.

### Setup disappears after a restart

The data directory is not persistent. Mount a persistent volume at `/data` and set `REELRELAY_DATA_DIR=/data`. Keep one application instance attached to that volume.

## Security notes

- Never commit Seerr passwords, Discord bot tokens, dashboard secrets, `reelrelay.enc`, or `reelrelay.key`.
- Rotate the Discord bot token immediately if it is exposed.
- Use a strong, unique dashboard secret.
- Terminate HTTPS at a trusted reverse proxy or hosting platform.
- Restrict access to the persistent volume and back it up securely.
- Keep the deployment at one instance unless the file store is replaced with concurrency-safe shared storage.

## Tech stack

- React 19, TypeScript, Vite, and Tailwind CSS
- Nitro server routes
- Discord REST and Interactions APIs
- Seerr web-session API
- AES-256-GCM encrypted local persistence
