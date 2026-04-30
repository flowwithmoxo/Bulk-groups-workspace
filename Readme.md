# Moxo Group Binder Creator

Create group binders (workspaces) for clients with internal team members in bulk using Moxo API.

## Features

- 🔐 OAuth token generation
- 👥 Bulk client upload (CSV)
- 👨‍💼 Internal team management
- 🏷️ Custom binder naming with variables (`{{name}}`, `{{email}}`)
- 👑 Flexible binder owner assignment (internal or client)
- 🏷️ Workspace tags support (JSON format)
- ⚡ Fast bulk creation - one API call per client
- 💾 Auto-save configuration

## How It Works

1. **Configure API** - Enter Moxo domain, Org ID, Client ID/Secret
2. **Generate Token** - Get access token for authentication
3. **Upload Clients** - CSV with email and name
4. **Add Internal Team** - CSV with emails and optional BOARD_OWNER flag
5. **Configure Binder Settings** - Name template, description, tags, owner
6. **Create** - One click creates binders for all clients

## CSV Formats

### Clients CSV (`clients_sample.csv`)
```csv
email,name
client1@example.com,John Client
client2@example.com,Sarah Client