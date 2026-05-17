# TheYep home server

This setup serves TheYep from this computer.

## Current network values

- Local PC IP: `192.168.15.3`
- Current public IP: `191.22.49.79`
- App port: `4100`
- Domain: `theyep.com.br`
- Cloudflare Tunnel: `theyep-home`
- Tunnel ID: `4995cafb-9f7a-4e42-93c2-31c9f255e11f`
- Public HTTPS status: active at `https://theyep.com.br` and `https://www.theyep.com.br`

The current public strategy is:

```text
Registro.br nameservers -> Cloudflare DNS -> Cloudflare Tunnel -> 127.0.0.1:4100
```

This avoids router port forwarding for `80` and `443`.

## Start the app server

```powershell
npm.cmd run home:server
```

For background mode:

```powershell
npm.cmd run home:launch
```

For public mode through Cloudflare Tunnel:

```powershell
npm.cmd run home:public
```

Status:

```powershell
npm.cmd run home:status
```

Stop:

```powershell
npm.cmd run home:stop
```

## Cloudflare Tunnel

Cloudflare Tunnel is now the preferred public layer. It keeps TheYep running on this computer while Cloudflare exposes the HTTPS domain without requiring inbound router ports.

The local tunnel config lives outside the repo:

```text
C:\Users\Serginho\.cloudflared\config.yml
```

It maps:

```text
theyep.com.br     -> http://127.0.0.1:4100
www.theyep.com.br -> http://127.0.0.1:4100
```

Start only the tunnel:

```powershell
npm.cmd run home:tunnel
```

Stop only the tunnel:

```powershell
npm.cmd run home:tunnel:stop
```

The tunnel was created in Cloudflare and the Cloudflare DNS records for `theyep.com.br` and `www.theyep.com.br` were routed to it.

Public DNS is now delegated to Cloudflare and routes through the tunnel.

## Start on Windows login

A startup command was created here:

```text
C:\Users\Serginho\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Start TheYep Home Server.cmd
```

It launches both the TheYep Node server and Cloudflare Tunnel when this Windows user logs in.

Refresh it after script changes:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-startup-shortcut.ps1
```

## DNS at Registro.br

For the Cloudflare Tunnel setup, Registro.br delegates DNS to Cloudflare instead of using direct `A` records to the home IP.

Current Cloudflare nameservers for this zone:

```text
jasmine.ns.cloudflare.com
norman.ns.cloudflare.com
```

The active public NS should look like Cloudflare, not Registro.br:

```text
jasmine.ns.cloudflare.com
norman.ns.cloudflare.com
```

Then `https://theyep.com.br` should route through the tunnel.

## Legacy Caddy path

Caddy was installed and can still be used for a direct home-server setup, but Vivo appears to block or reserve public `80`/`443` in this environment.

The legacy direct-router path was:

```text
Registro.br A records -> public home IP -> router port forwarding -> Caddy -> 127.0.0.1:4100
```

That path required:

```text
TCP 80  -> 192.168.15.3:80
TCP 443 -> 192.168.15.3:443
```

## Windows Firewall

Run PowerShell as Administrator:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/open-firewall-ports.ps1
```

## Important checks

- With Cloudflare Tunnel, changes to the home public IP do not require DNS edits.
- The computer must stay on, connected to the internet, and not sleeping.
- The TheYep Node server and Cloudflare Tunnel must both be running.

## E-mail confirmation

The backend sends account confirmation codes by SMTP when `THEYEP_SMTP_PASS` is configured in `.env.production.local`.

Current default SMTP values:

```text
THEYEP_EMAIL_FROM=theyep.team@gmail.com
THEYEP_SMTP_HOST=smtp.gmail.com
THEYEP_SMTP_PORT=587
THEYEP_SMTP_USER=theyep.team@gmail.com
```

Configure the password locally:

```powershell
npm.cmd run email:configure
```

For Gmail, use an app password, not the normal account password.

Send a test:

```powershell
npm.cmd run email:test -- seu-email@gmail.com
```

Restart the public stack after changing SMTP settings:

```powershell
npm.cmd run home:stop
npm.cmd run home:public
```
