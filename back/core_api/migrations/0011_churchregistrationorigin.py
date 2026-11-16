from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('core_api', '0010_loginattemptwindow')]

    operations = [
        migrations.CreateModel(
            name='ChurchRegistrationOrigin',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ip_hash', models.CharField(max_length=64, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('church', models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name='public_registration_origin', to='core_api.church')),
            ],
        ),
    ]
