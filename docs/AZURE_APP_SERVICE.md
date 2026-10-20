# Deploy ECG SHE on Azure App Service

Deploy the API and the web app as two Linux App Services, and put the data in Azure SQL. The SQLite file on a developer PC does not carry over.

The names below are examples. Change them if these names are already taken.

| Piece | Example name |
| --- | --- |
| Resource group | `ecg-she-rg` |
| Azure SQL server | `ecg-she-sql` |
| Database | `ecg_she` |
| Container registry | `ecgsheacr` |
| App Service plan | `ecg-she-plan` |
| API app | `ecg-she-api` |
| Web app | `ecg-she-web` |

Run the commands in Azure Cloud Shell, or on a PC where `az login` is already done. Build the images from the repository root.

## 1. Create the resource group and the database

```bash
az group create --name ecg-she-rg --location westeurope

az sql server create \
  --name ecg-she-sql \
  --resource-group ecg-she-rg \
  --location westeurope \
  --admin-user ecg_she_admin \
  --admin-password "<a long password>"

az sql server firewall-rule create \
  --resource-group ecg-she-rg \
  --server ecg-she-sql \
  --name AllowAzure \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

az sql db create \
  --resource-group ecg-she-rg \
  --server ecg-she-sql \
  --name ecg_she \
  --service-objective S0
```

The firewall rule lets the App Service reach the database. The login name for the API is `ecg_she_admin`. The host is `ecg-she-sql.database.windows.net`.

## 2. Build the two images

```bash
az acr create \
  --name ecgsheacr \
  --resource-group ecg-she-rg \
  --sku Basic \
  --admin-enabled true

az acr login --name ecgsheacr
```

The API image builds as it is:

```bash
docker build -f apps/api/Dockerfile -t ecgsheacr.azurecr.io/ecg-she-api:1 .
docker push ecgsheacr.azurecr.io/ecg-she-api:1
```

The web app bakes the API address into the pages at build time. Add these lines to `apps/web/Dockerfile` immediately before `RUN npm run build`:

```dockerfile
ARG VITE_API_BASE_URL
ARG VITE_WS_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_URL=$VITE_WS_URL
```

The API's public address is `https://ecg-she-api.azurewebsites.net`. Build the web image with that address:

```bash
docker build -f apps/web/Dockerfile \
  -t ecgsheacr.azurecr.io/ecg-she-web:1 \
  --build-arg VITE_API_BASE_URL=https://ecg-she-api.azurewebsites.net/api/v1 \
  --build-arg VITE_WS_URL=https://ecg-she-api.azurewebsites.net \
  .

docker push ecgsheacr.azurecr.io/ecg-she-web:1
```

If that URL is still `localhost`, sign-in on Azure fails. The browser calls the visitor's own computer instead of the API.

## 3. Create the API App Service

```bash
az appservice plan create \
  --name ecg-she-plan \
  --resource-group ecg-she-rg \
  --is-linux \
  --sku B1

az webapp create \
  --resource-group ecg-she-rg \
  --plan ecg-she-plan \
  --name ecg-she-api \
  --deployment-container-image-name ecgsheacr.azurecr.io/ecg-she-api:1

az webapp config appsettings set \
  --resource-group ecg-she-rg \
  --name ecg-she-api \
  --settings WEBSITES_PORT=4000

az webapp config set \
  --resource-group ecg-she-rg \
  --name ecg-she-api \
  --generic-configurations "{\"webSocketsEnabled\": true}"
```

In the portal, open the API app, go to **Deployment Center**, and sign it into `ecgsheacr`.

Generate three different secrets, each at least 32 characters. Do not reuse the values from the local `.env`. Production refuses those placeholders.

Set these application settings on `ecg-she-api`:

| Setting | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `API_PORT` | `4000` |
| `CORS_ORIGIN` | `https://ecg-she-web.azurewebsites.net` |
| `DB_TYPE` | `mssql` |
| `DB_HOST` | `ecg-she-sql.database.windows.net` |
| `DB_PORT` | `1433` |
| `DB_USERNAME` | `ecg_she_admin` |
| `DB_PASSWORD` | the server password |
| `DB_NAME` | `ecg_she` |
| `DB_SSL` | `true` |
| `DB_SYNCHRONIZE` | `true` for the first start only |
| `REDIS_ENABLED` | `false` |
| `AUTH_PROVIDER` | `local` |
| `JWT_ACCESS_SECRET` | a new secret |
| `JWT_REFRESH_SECRET` | a different new secret |
| `DATA_ENCRYPTION_KEY` | a third new secret, stored as a Key Vault reference |
| `DATA_ENCRYPTION_KEY_PREVIOUS` | empty until the first key rotation |

Store `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATA_ENCRYPTION_KEY`, and `DB_PASSWORD` in Key Vault and reference them from the API app settings. `DB_SSL=true` checks the Azure SQL certificate and refuses TLS below 1.2. The rotation, backup, and revocation steps are in `docs/CONFIGURATION.md` under Secret handling.
| `STORAGE_DRIVER` | `local` until a storage account exists |

`DB_SYNCHRONIZE=true` creates the tables. The migration in this repo does not. After the API log says it is listening, set `DB_SYNCHRONIZE` back to `false` and restart. Leaving it on lets a later deploy rewrite the database.

Production does not create the local test accounts. Create the first administrator in the database, or run one private first start with `NODE_ENV` left unset and `BOOTSTRAP_AUTOSEED=true`, sign in, then switch `NODE_ENV` to `production` and `BOOTSTRAP_AUTOSEED` to `false`. A Head Office or system administrator must enroll MFA on the next production sign-in.

Restart the API and open `https://ecg-she-api.azurewebsites.net/api/v1`. A `401` means it is up.

## 4. Create the web App Service

```bash
az webapp create \
  --resource-group ecg-she-rg \
  --plan ecg-she-plan \
  --name ecg-she-web \
  --deployment-container-image-name ecgsheacr.azurecr.io/ecg-she-web:1

az webapp config appsettings set \
  --resource-group ecg-she-rg \
  --name ecg-she-web \
  --settings WEBSITES_PORT=80
```

Sign this app into the same registry. Open `https://ecg-she-web.azurewebsites.net` and sign in.

## 5. Turn on Microsoft sign-in when ECG is ready

Register an app in Microsoft Entra ID. The redirect URI is:

`https://ecg-she-web.azurewebsites.net/auth/callback`

On the API, set `AUTH_PROVIDER=hybrid` and fill `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, and `ENTRA_REDIRECT_URI`.

`VITE_ENTRA_TENANT_ID`, `VITE_ENTRA_CLIENT_ID`, and `VITE_ENTRA_AUDIENCE` are baked in at build time. Rebuild and push `ecg-she-web:2` after they are set, then point the web app at that image.

People who sign in with Microsoft arrive as staff. Assign safety officers from **Administration**, by email.

## 6. Keep photos

`STORAGE_DRIVER=local` stores photos on the App Service disk, and that disk is wiped when the app restarts. For a real deployment, create a storage account and set:

| Setting | Value |
| --- | --- |
| `STORAGE_DRIVER` | `azure-blob` |
| `AZURE_STORAGE_ACCOUNT` | the storage account name |
| `AZURE_STORAGE_CONTAINER` | the container name |
| `AZURE_STORAGE_KEY` | the account key |
