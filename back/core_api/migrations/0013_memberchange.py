from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('core_api', '0012_member_privacy_consent'), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [migrations.CreateModel(name='MemberChange', fields=[
        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        ('changes', models.JSONField()),
        ('created_at', models.DateTimeField(auto_now_add=True)),
        ('actor', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='member_changes', to=settings.AUTH_USER_MODEL)),
        ('member', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='change_history', to='core_api.member')),
    ], options={'ordering': ['-created_at', '-id']})]
