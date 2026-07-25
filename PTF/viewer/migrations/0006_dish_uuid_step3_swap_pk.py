from django.db import migrations, models
import uuid


def swap_primary_key(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        raise RuntimeError(
            "This migration's data-preserving PK swap is written specifically "
            "for PostgreSQL (production's actual database). If you need to "
            "run it against another backend (e.g. sqlite for local testing), "
            "it's simplest to just delete and recreate a fresh local dev "
            "database instead of running this migration against it."
        )

    table = '"dashboardMenu_dish"'
    with schema_editor.connection.cursor() as cursor:
        # 1. Drop the existing primary key constraint on the old integer id.
        cursor.execute(f'ALTER TABLE {table} DROP CONSTRAINT "dashboardMenu_dish_pkey"')
        # 2. Drop the old integer id column entirely — every row's data has
        #    already been carried over via new_id in the previous migration.
        cursor.execute(f'ALTER TABLE {table} DROP COLUMN "id"')
        # 3. Promote new_id to be the id column.
        cursor.execute(f'ALTER TABLE {table} RENAME COLUMN "new_id" TO "id"')
        cursor.execute(f'ALTER TABLE {table} ALTER COLUMN "id" SET NOT NULL')
        cursor.execute(f'ALTER TABLE {table} ADD PRIMARY KEY ("id")')


def noop_reverse(apps, schema_editor):
    raise RuntimeError(
        "This migration cannot be reversed automatically — the original "
        "integer ids are gone once this runs. Restore from a database "
        "backup taken before migrating if you need to roll back."
    )


class Migration(migrations.Migration):

    dependencies = [
        ('dashboardMenu', '0005_dish_uuid_step2_populate'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(swap_primary_key, noop_reverse),
            ],
            state_operations=[
                migrations.RemoveField(model_name='dish', name='id'),
                migrations.RenameField(model_name='dish', old_name='new_id', new_name='id'),
                migrations.AlterField(
                    model_name='dish',
                    name='id',
                    field=models.UUIDField(primary_key=True, serialize=False, editable=False, default=uuid.uuid4),
                ),
            ],
        ),
    ]