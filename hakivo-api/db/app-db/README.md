# Database Migrations

This folder contains SQL migration files that are automatically executed by Raindrop during the `raindrop build deploy` command.

## File Naming Convention

Migration files should follow this naming pattern:

```
<number>_<description>.sql
```

Where:

- `<number>` is a 4-digit padded number (starting with `0000`)
- `<description>` is a brief description of what the migration does

For example:

- `0000_initial_schema.sql`
- `0001_add_users_table.sql`
- `0002_add_foreign_keys.sql`

## Execution Order

Files are executed in ascending alphabetical order. Therefore, the numbering system ensures migrations run in the intended sequence.
