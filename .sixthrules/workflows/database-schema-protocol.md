# database-schema-protocol.md

> Mongoose database schema updates, indexing safety, and data backfilling protocol.

This protocol is active when modifying Mongoose models in `apps/api/src/models/`, adding indexes, or updating the database seed configurations in `apps/api/src/scripts/seed.ts`.

## When to Use

- Adding a new field to a database collection.
- Modifying or deprecating an existing schema attribute.
- Creating a database index to speed up queries.
- Troubleshooting seeding/database configuration in local development or test suites.

## Safety Guidelines

MongoDB is schema-less, but Mongoose enforces schema validation at runtime. To avoid breaking queries or failing to load historical documents, follow these safety rules:

1. **Additive Schema Modifications:** Always design schema changes to be additive. If you add a new property, ensure it has a `default` value configured in the schema, or make it optional.
2. **Schema Versioning:** For complex collections (e.g. `tenants`, `payments`), include a `schemaVersion` attribute (defaulting to current version) to support document transformation at runtime if shapes diverge.
3. **No Downtime Renames:** Never rename an active field directly. Use a deprecation timeline:
   - Step A: Add the new field to the schema and write to both.
   - Step B: Run a script to copy data from the old field to the new field.
   - Step C: Update reads to consume the new field.
   - Step D: Deprecate and remove the old field from the schema.
4. **Background Indexing:** Avoid causing database locks on large collections. Specify `{ background: true }` when declaring custom Mongoose schema indexes.

## Step-by-Step Protocol (Mongoose schema change)

### Phase 1: Local Type Registration

1. Edit the type definition inside [packages/types/src/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/packages/types/src/).
2. Run type compilation checks.

### Phase 2: Mongoose Schema Update

1. Modify the Mongoose schema inside [apps/api/src/models/](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/models/).
2. Provide default values for all new properties.
3. Run `bun --filter '@pg/api' typecheck` to check for model schema compliance.

### Phase 3: Seeding Update

1. Update [apps/api/src/scripts/seed.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/scripts/seed.ts) to populate the new properties when generating sample collections.
2. Run the seeding tool locally to verify:
   - `bun run seed:sample`

### Phase 4: Data Backfilling (If Required)

1. Write a script to migrate existing production documents.
2. The backfill script must process documents in batches (e.g. using `cursor.next()`) rather than reading the entire collection into memory.
3. Ensure the script is idempotent and can be re-run safely if interrupted.

## Verification & Gates

Before declaring schema changes complete:

- Run the local seed command `bun run seed` and verify the process exits with 0.
- Verify that historical documents load successfully in local test environments.
- Ensure that the Mongoose models export files inside [apps/api/src/models/index.ts](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/apps/api/src/models/index.ts) are updated.
- Verify index definitions: Check that no duplicate index configurations exist on the collection.

## Failure Modes & Anti-Patterns

- **Missing Schema Defaults:** Adding a required field without a default value, leading to Mongoose validation errors (`ValidationError: Path 'X' is required`) when fetching existing documents from the database.
- **Large Table Locks:** Declaring a non-background index on a high-write collection, which blocks other API operations.
- **Memory-Heavy Seed Scripts:** Reading millions of records into memory at once during updates. Always stream or use batch offsets.

## Cross-References

- See [automation-loop.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/automation-loop.md) for execution and verification loops.
- See [code-quality-verification-gates.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/code-quality-verification-gates.md) for build validation.
- See [codebase-index.md](file:///Users/jay/Development/Projects/Personal%20Projects/tenet_pg_management/.sixthrules/workflows/codebase-index.md) for database model listings.
