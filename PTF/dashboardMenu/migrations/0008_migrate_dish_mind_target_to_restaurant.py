from django.db import migrations


def migrate_dish_mind_target_to_restaurant(apps, schema_editor):
    """
    Best-effort: for every restaurant that doesn't already have its own
    mind_target, look for any dish under it that had one uploaded (from
    back when mind_target lived on Dish) and copy that file up to the
    restaurant instead. If a restaurant has dishes with several *different*
    mind_target files, only the first one found is kept — the rest are
    reported via this migration's own output so nothing is silently lost;
    review and re-upload manually in admin if that happens.
    """
    Restaurant = apps.get_model('dashboardMenu', 'Restaurant')
    Dish = apps.get_model('dashboardMenu', 'Dish')

    migrated, conflicts, read_failures = 0, [], []

    for restaurant in Restaurant.objects.all():
        if restaurant.mind_target:
            continue  # already has one, don't overwrite

        dishes_with_target = list(
            Dish.objects.filter(category__restaurant=restaurant)
            .exclude(mind_target__isnull=True)
            .exclude(mind_target="")
        )
        if not dishes_with_target:
            continue

        distinct_files = {d.mind_target.name for d in dishes_with_target}
        source_dish = dishes_with_target[0]

        try:
            source_dish.mind_target.open("rb")
            content = source_dish.mind_target.read()
            source_dish.mind_target.close()
        except Exception:
            read_failures.append(restaurant.business_name)
            continue

        from django.core.files.base import ContentFile
        filename = source_dish.mind_target.name.rsplit("/", 1)[-1]
        restaurant.mind_target.save(filename, ContentFile(content), save=True)
        migrated += 1

        if len(distinct_files) > 1:
            conflicts.append(restaurant.business_name)

    if migrated:
        print(f"\n  [migrate mind_target dish->restaurant] Migrated {migrated} restaurant(s) a shared marker from one of their dishes.")
    if conflicts:
        print(f"  [migrate mind_target dish->restaurant] These restaurants had MULTIPLE different dish mind_targets — only one was kept, review in admin: {', '.join(conflicts)}")
    if read_failures:
        print(f"  [migrate mind_target dish->restaurant] Couldn't read the source file for: {', '.join(read_failures)} — re-upload manually in admin.")


def noop_reverse(apps, schema_editor):
    # Not reversible — we don't know which dish (if any) a restaurant's
    # mind_target originally came from once this has run.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('dashboardMenu', '0007_restaurant_mind_target'),
    ]

    operations = [
        migrations.RunPython(migrate_dish_mind_target_to_restaurant, noop_reverse),
    ]