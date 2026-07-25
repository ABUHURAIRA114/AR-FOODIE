import uuid
from django.db import migrations


def populate_new_id(apps, schema_editor):
    Dish = apps.get_model('dashboardMenu', 'Dish')
    # One UUID per row, generated in Python row-by-row — this is exactly
    # what the direct AlterField approach can't do (it can only cast
    # existing values or apply a single literal default to every row).
    dishes = list(Dish.objects.all().only('id'))
    for dish in dishes:
        dish.new_id = uuid.uuid4()
    Dish.objects.bulk_update(dishes, ['new_id'], batch_size=500)


def noop_reverse(apps, schema_editor):
    # Nothing meaningful to reverse into — the old integer ids are still
    # intact at this point (this migration only touches new_id), so
    # reversing is simply "do nothing".
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('dashboardMenu', '0004_dish_uuid_step1_add_field'),
    ]

    operations = [
        migrations.RunPython(populate_new_id, noop_reverse),
    ]