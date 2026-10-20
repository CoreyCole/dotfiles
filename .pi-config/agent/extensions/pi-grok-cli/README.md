# Pi Grok CLI

The local extension name is `pi-grok-cli`.

This extension started from `kenryu42/pi-grok-cli` at commit `3f5837aac6d0275d86d983b96be90bfecb0d0c4a`.

Upstream repository: <https://github.com/kenryu42/pi-grok-cli>

The MIT license from the upstream repository is in `LICENSE`.

## Provider

The extension adds the `grok-cli` provider. It does not replace the built-in `xai` provider.

## Team accounts

A team account must send `principal_type` and `principal_id` on token refresh.

The extension reads those claims from the access token. If a claim is missing, it reads `id_token`.

It stores `principalType`, `principalId`, and `teamId` on the account credential.

Refresh sends `principal_type` and `principal_id` when they are present. It does not send `teamId`.

A personal account has no principal fields. Its refresh body stays the original params.

This copy does not import `~/.grok/auth.json`.

## Log in

1. Run `/login`.
2. Choose the Grok CLI provider (`grok-cli`).
3. Complete browser login or device-code login.

Run `/grok-cli-accounts` to switch accounts, add an account, or log an account out.

Device-code login shows the user code in the Pi login dialog. It also prints the code and the verification URI in the terminal.

Account credentials are stored in `~/.local/share/pi-grok-cli/accounts.json`. Pi stores only a connection marker.
