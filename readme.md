# Tankmas Server

A websocket server for the tankmas games.

## Setup

1. [Install Deno](https://docs.deno.com/runtime/getting_started/installation/).
2. Create an `.env` file:
```bash
NG_APP_ID=the app id
DEV_MODE=true or false
SERVER_PORT=5000 # Defaults to 5000, but can be changed

# If true, the server will run on https
USE_TLS=true or false
CA_CERT_FILE= path to certificate (fullchain) file
CA_KEY_FILE= path to privkey
```
3. Install the VS Code extensions [Deno](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno) and [Biome](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) (for code formatting and linting).
4. Run `deno task dev` in your terminal.