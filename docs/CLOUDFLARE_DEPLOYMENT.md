# Deploy named accounts to Cloudflare

Gymmiie uses Cloudflare Workers Builds for deployments from GitHub `main`, and D1 for named account tracking. The Worker name is `gymmiie`. Use Node 22 or newer.

## 1. Prepare the database

From the repository root:

```sh
npm ci --ignore-scripts
npx wrangler login --env-file /dev/null
```

If the D1 database does not exist yet:

```sh
npm run db:create -- --env-file /dev/null
```

Otherwise, reuse the existing `gymmiie` database. Copy its database ID into the existing `database_id` entry in `wrangler.toml`, replacing the placeholder. Keep the binding name `DB` and the migrations directory `migrations`.

Apply the migrations to that database:

```sh
npm run db:migrate -- --env-file /dev/null
```

This applies the pending migrations, including `0002_accounts.sql`. It creates account, session, profile, save-receipt, and rate-limit tables while retaining the earlier encrypted snapshot table. Run pending migrations before deploying code that needs them; deploying the Worker does not apply SQL migrations automatically.

## 2. Configure the registration secret

```sh
npx wrangler secret put REGISTRATION_PASSPHRASE --env-file /dev/null
```

Enter the shared registration phrase supplied by the app owner at the masked prompt. Keep the actual value out of source files, Git, build variables, command arguments, and documentation.

If Wrangler says the Worker does not exist, confirm creation of a Worker named `gymmiie`. Wrangler creates a draft Worker, adds the secret, and the subsequent application deployment supplies the real code and assets.

For an existing Worker, the dashboard alternative is **Workers & Pages → gymmiie → Settings → Variables and Secrets → Add → Secret**. Use the variable name `REGISTRATION_PASSPHRASE`, enter its value, then deploy the secret change. This is a runtime secret, separate from the build variables.

Wrangler secret updates create and deploy a Worker version. The project declares this secret as required, so code deployment fails clearly if it has not been configured. A missing registration secret also fails account creation closed.

## 3. Commit and push

Stage the intended app changes, including `wrangler.toml`, the migrations, generated Worker binding types, scripts, and package lockfile. Create a semantic commit, then push:

```sh
git push origin main
```

The implementation changes are local until committed and pushed.

## 4. Connect or update Workers Builds

Use these settings in Cloudflare's Git-connected Worker:

| Setting | Value |
| --- | --- |
| Worker/project name | `gymmiie` |
| Production branch | `main` |
| Repository root | `/` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Build variable | `NODE_VERSION=22` |
| Preview builds | Disabled until a separate preview configuration is added |

The preview command can remain `npx wrangler preview`; it is unused while preview builds are disabled.

Click **Deploy**, or retry the latest build if the Git connection already exists. Confirm **Settings → Build → Branch control** uses `main`. Subsequent pushes to that branch run the build and deploy automatically.

## 5. Verify the deployed app

1. Open the Worker's HTTPS URL. Close existing Gymmiie tabs/PWA windows and reopen if the old offline app is still showing, so its waiting update can activate. The home page should show Name and PIN (4 digits).
2. Enter a name and a 4-digit PIN. For an older telephone account, choose **Set PIN for existing account** and confirm the original name and international telephone once to enroll a PIN while retaining the tracking data.
3. A new identity offers account creation and requires the registration phrase. An existing identity opens its tracking without requiring that phrase again.
4. Add a workout and wait for the account sync status to show that it is current.
5. Open a different browser/device, enter the same name and PIN, and verify the tracking loads.
6. Switch users and confirm the second account does not show the first account's tracking.

Existing device-only logs are preserved separately and can be reviewed/imported explicitly after sign-in. Previous encrypted snapshots remain available through the manual backup tools.

## Account access policy

The combined normalized name and PIN is unique. Display-name edits do not change the login identity. Names use Unicode normalization, collapsed whitespace and lowercase matching. Migration `0003_account_pins.sql` adds PIN credentials without replacing account IDs or tracking data. Original telephone details are accepted only for initial PIN enrollment and replaced with an internal marker after successful enrollment.

Returning access uses name and a 4-digit PIN. PINs have 10,000 possible values and are stored as PBKDF2-SHA-256 hashes with random salts per normalized name. The shared registration phrase gates creation, and the server limits requests by IP and PIN attempts by normalized name. Account tracking is server-readable D1 data; the optional manual encrypted snapshots remain a separate feature.

## Official references

- [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Branch controls](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Build Node version](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/#overriding-default-versions)
