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

### Deploy

1. Publish the repository to GitHub or publish its Docker image to a registry supported by Bunny.
2. In **Magic Containers**, create an application from the repository or image.
3. Set the container port, persistent volume, health checks, and instance limits using the table above.
4. Deploy and open the public hostname assigned to the application.
5. Complete ReelRelay's **Setup** page with the Seerr and Discord credentials.
6. In the Discord Developer Portal, set the Interactions Endpoint URL to:

   `https://YOUR-BUNNY-HOST/api/bot/interactions`

7. Return to ReelRelay and choose **Publish /request**.

The public hostname must use HTTPS because Discord requires a publicly reachable HTTPS interactions endpoint.

## Persistent data

ReelRelay writes two files in `REELRELAY_DATA_DIR`:

- `reelrelay.enc` — encrypted configuration and tracked requests;
- `reelrelay.key` — the local encryption seed.

Both files are excluded from Git and the Docker build context. Back up the entire persistent volume together; the encrypted store cannot be opened without its matching key file.
