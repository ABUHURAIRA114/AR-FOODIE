# Generated manually for the new Restaurant.secondary_color field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('dashboardMenu', '0010_merge_20260729_0024'),
    ]

    operations = [
        migrations.AddField(
            model_name='restaurant',
            name='secondary_color',
            field=models.CharField(
                default='#f0f0f0',
                help_text=(
                    "A restaurant's second brand color — currently used as "
                    "the full-page background of the single-dish AR viewer, "
                    "and for the \"View Menu\" button on the public "
                    "restaurant directory page."
                ),
                max_length=7,
            ),
        ),
    ]