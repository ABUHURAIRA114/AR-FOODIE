import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('dashboardMenu', '0003_dish_ar_scale_dish_environment_image_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='dish',
            name='new_id',
            # Deliberately nullable with NO default at this step. A callable
            # default like uuid.uuid4 on AddField only gets evaluated once
            # for the whole ALTER TABLE, not per row — every existing dish
            # would end up with the SAME uuid otherwise. Values are
            # populated per-row in the next migration instead.
            field=models.UUIDField(null=True, editable=False),
        ),
    ]