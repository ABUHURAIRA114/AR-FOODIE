from django.db import migrations


def copy_scene_data_to_dish(apps, schema_editor):
    """
    Best-effort data migration: Scene and Dish were always separate,
    unrelated tables (no foreign key ever connected them), so there's no
    guaranteed way to know which Scene belonged to which Dish. The only
    field they share is a name, so this matches them up by
    case-insensitive exact name match and copies every migrated field
    across for any match found. Scenes with no matching Dish name (or
    ambiguous matches against multiple dishes) are skipped and reported
    via the migration's own stdout so nothing is silently lost — if you
    see skipped scenes printed when running `migrate`, set those fields
    manually on the corresponding Dish in Django admin afterward.
    """
    Scene = apps.get_model('viewer', 'Scene')
    Dish = apps.get_model('dashboardMenu', 'Dish')

    fields_to_copy = [
        'usdz_file', 'mind_target', 'exposure', 'shadow_intensity',
        'shadow_softness', 'tone_mapping', 'environment_image',
        'environment_image_url', 'ar_scale', 'webxr_model_scale',
    ]

    matched, skipped_no_match, skipped_ambiguous = 0, [], []

    for scene in Scene.objects.all():
        candidates = list(Dish.objects.filter(name__iexact=scene.name))

        if len(candidates) == 0:
            skipped_no_match.append(scene.name)
            continue
        if len(candidates) > 1:
            skipped_ambiguous.append(scene.name)
            continue

        dish = candidates[0]
        for field in fields_to_copy:
            setattr(dish, field, getattr(scene, field))
        # Scene.glb_file was required; only overwrite Dish.glb_file if the
        # dish doesn't already have one of its own set.
        if scene.glb_file and not dish.glb_file:
            dish.glb_file = scene.glb_file
        dish.save()
        matched += 1

    if matched:
        print(f"\n  [migrate scene->dish] Copied {matched} scene(s) onto matching dish(es) by name.")
    if skipped_no_match:
        print(f"  [migrate scene->dish] No matching dish name for: {', '.join(skipped_no_match)}")
    if skipped_ambiguous:
        print(f"  [migrate scene->dish] Multiple dishes share this name, skipped: {', '.join(skipped_ambiguous)}")
    if skipped_no_match or skipped_ambiguous:
        print("  [migrate scene->dish] Set AR/lighting fields manually in Django admin for any skipped above.\n")


def noop_reverse(apps, schema_editor):
    # Not reversible — Scene is being removed entirely in a later migration,
    # so there's nothing meaningful to reverse this into.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('viewer', '0004_scene_mind_target'),
        ('dashboardMenu', '0003_dish_ar_scale_dish_environment_image_and_more'),
    ]

    operations = [
        migrations.RunPython(copy_scene_data_to_dish, noop_reverse),
    ]