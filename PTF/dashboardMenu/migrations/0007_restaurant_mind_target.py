from django.db import migrations, models
import dashboardMenu.models


class Migration(migrations.Migration):

    dependencies = [
        ('dashboardMenu', '0006_dish_uuid_step3_swap_pk'),
    ]

    operations = [
        migrations.AddField(
            model_name='restaurant',
            name='mind_target',
            field=models.FileField(
                blank=True, null=True,
                upload_to=dashboardMenu.models.restaurant_mind_target_path,
                help_text=(
                    "Compiled MindAR .mind target file for the image-tracking AR "
                    "fallback, generated from a marker image via MindAR's compiler: "
                    "https://hiukim.github.io/mind-ar-js-doc/tools/compile — one per "
                    "restaurant (e.g. a printed table tent or menu cover), shared by "
                    "every dish in this restaurant's menu. Scanning it and picking a "
                    "dish shows that dish's 3D model on top of this same marker."
                ),
            ),
        ),
    ]