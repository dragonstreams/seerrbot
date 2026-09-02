# ReelRelay

ReelRelay is a Discord bot and control dashboard for submitting movie and TV requests through a Seerr account. It signs in with the configured Seerr username and password, so no Seerr API key is required.

## Bunny Magic Containers deployment

The repository includes a production, multi-stage `Dockerfile` for Bunny.net Magic Containers. The final image:

- initializes Bunny's root-owned persistent volume, then runs the Nitro server as a non-root user;
- listens on `0.0.0.0:8080`;
- exposes `GET /api/health` for container health checks;
- stores encrypted credentials and request history under `/data`;
- checks Seerr every two minutes and sends Discord fulfillment notifications.

### Container settings

Use these values when creating the Magic Container application:

| Setting | Value |
| --- | --- |
| Container port | `8080` |
| Environment variable | `REELRELAY_DATA_DIR=/data` |
| Persistent volume mount | `/data` |
| Startup health check | HTTP GET `/api/health` on port `8080` |
| Readiness health check | HTTP GET `/api/health` on port `8080` |
| Liveness health check | HTTP GET `/api/health` on port `8080` |
| Minimum instances | `1` |
| Maximum instances | `1` |

Keep the application at one instance because the encrypted local store is mounted as a single persistent volume. Without the `/data` persistent volume, setup and request history will be lost when Bunny replaces or restarts the container.

### Build and deploy

The included GitHub Actions workflow builds the image on every push to `main` or `master`, and can also be started manually from GitHub's **Actions** tab. It publishes these GHCR tags:

- `ghcr.io/OWNER/REPOSITORY:latest` for the default branch;
- `ghcr.io/OWNER/REPOSITORY:sha-COMMIT` for immutable deployments;
- `ghcr.io/OWNER/REPOSITORY:vX.Y.Z` for Git tags.

1. Open the completed **Build ReelRelay container** workflow in GitHub Actions.
2. Open the published package and make it public, or add GHCR as a private image registry in Bunny using a GitHub token with `read:packages` access.
3. In **Magic Containers**, create an application using `ghcr.io/OWNER/REPOSITORY:latest`.
4. Set the container port, persistent volume, health checks, and instance limits using the table above.
5. Deploy and open the public hostname assigned to the application.
6. Complete ReelRelay's **Setup** page with the Seerr and Discord credentials.
7. In the Discord Developer Portal, set the Interactions Endpoint URL to:

   `https://YOUR-BUNNY-HOST/api/bot/interactions`

8. Return to ReelRelay and choose **Publish /request**.

The public hostname must use HTTPS because Discord requires a publicly reachable HTTPS interactions endpoint.

## Persistent data

ReelRelay writes two files in `REELRELAY_DATA_DIR`:

- `reelrelay.enc` — encrypted configuration and tracked requests;
- `reelrelay.key` — the local encryption seed.

Both files are excluded from Git and the Docker build context. Back up the entire persistent volume together; the encrypted store cannot be opened without its matching key file.
