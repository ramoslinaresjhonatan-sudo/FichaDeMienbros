from django.db import migrations


def link_parents(apps, schema_editor):
    Member = apps.get_model('core_api', 'Member')
    for child in Member.objects.all().iterator():
        changes = []
        for relation in ('father', 'mother'):
            identity = getattr(child, f'{relation}_identity_card')
            if identity and not getattr(child, f'{relation}_id'):
                parent = Member.objects.filter(identity_card=identity).exclude(pk=child.pk).first()
                if parent:
                    setattr(child, f'{relation}_id', parent.pk)
                    changes.append(relation)
        if changes:
            child.save(update_fields=changes)


class Migration(migrations.Migration):
    dependencies = [('core_api', '0005_baptism_church_baptism_date_baptism_notes_and_more')]
    operations = [migrations.RunPython(link_parents, migrations.RunPython.noop)]
