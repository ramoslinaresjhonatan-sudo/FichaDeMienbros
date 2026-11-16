from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('core_api', '0011_churchregistrationorigin')]

    operations = [
        migrations.AddField(model_name='member', name='privacy_consent_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='member', name='privacy_consent_version', field=models.CharField(blank=True, max_length=30)),
    ]
