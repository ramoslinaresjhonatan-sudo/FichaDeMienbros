from django.db import migrations, models
from django.contrib.auth.hashers import make_password


def invalidate_carnet_passwords(apps, schema_editor):
    User = apps.get_model('core_api', 'User')
    for user in User.objects.filter(temporary_password=True).iterator():
        user.password = make_password(None)
        user.temporary_password = False
        user.save(update_fields=['password', 'temporary_password'])


class Migration(migrations.Migration):
    dependencies = [('core_api', '0009_user_temporary_password')]
    operations = [migrations.CreateModel(name='LoginAttemptWindow', fields=[('key', models.CharField(max_length=64, primary_key=True, serialize=False)), ('started_at', models.DateTimeField()), ('attempts', models.PositiveIntegerField(default=0))]), migrations.RunPython(invalidate_carnet_passwords, migrations.RunPython.noop)]
