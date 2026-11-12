from django.db import migrations

def create_departments(apps, schema_editor):
    Department = apps.get_model('core_api', 'Department')
    for name in ['Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro', 'Pando', 'Potosí', 'Santa Cruz', 'Tarija']:
        Department.objects.get_or_create(name=name)

class Migration(migrations.Migration):
    dependencies = [('core_api', '0001_initial')]
    operations = [migrations.RunPython(create_departments, migrations.RunPython.noop)]
