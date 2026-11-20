from django.test import TestCase, Client
from django.test import override_settings
from unittest.mock import patch
from rest_framework.test import APIClient
from core_api.models import Department, Member, User, Church, ChurchRegistrationOrigin

class ApiTests(TestCase):
    def setUp(self):
        self.member = Member.objects.create(names='Ana')
        self.admin = User.objects.create_user(username='admin', email='admin@example.com', password='Test-password-928', role='administrador')
        self.pastor = User.objects.create_user(username='pastor', email='pastor@example.com', password='Test-password-928', role='pastor', member=self.member)
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def test_seeded_departments(self):
        self.assertEqual(Department.objects.count(), 9)

    def test_api_requires_authentication(self):
        self.api.force_authenticate(None)
        self.assertEqual(self.api.get('/api/miembros/').status_code, 403)

    def test_baptism_accepts_pastor_and_rejects_administrator(self):
        data = {'member': self.member.id, 'pastor': self.admin.id, 'date': '2020-05-01'}
        self.assertEqual(self.api.post('/api/bautismos/', data).status_code, 400)
        data['pastor'] = self.pastor.id
        self.assertEqual(self.api.post('/api/bautismos/', data).status_code, 201)

    def test_pastor_requires_member(self):
        response = self.api.post('/api/usuarios/', {'username': 'nuevo', 'email': 'nuevo@example.com', 'role': 'pastor', 'password': 'Safe-password-248'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('member', response.data)

    def test_church_is_annulled_instead_of_deleted(self):
        church = Church.objects.create(name='Central', department=Department.objects.first())
        self.assertEqual(self.api.delete(f'/api/iglesias/{church.pk}/').status_code, 405)
        self.assertEqual(self.api.post(f'/api/iglesias/{church.pk}/anular/').status_code, 200)
        church.refresh_from_db()
        self.assertEqual(church.status, 'anulada')

    def test_registration_options_include_department_and_only_active_churches(self):
        la_paz = Department.objects.get(name='La Paz')
        active = Church.objects.create(name='Central', department=la_paz)
        Church.objects.create(name='Anulada', department=la_paz, status='anulada')
        options = self.client.get('/api/registro/opciones/').json()['churches']
        self.assertIn({'id': active.id, 'name': 'Central', 'department': 'La Paz'}, options)
        self.assertEqual(len(options), 1)

    def test_public_church_directory_allows_only_one_registration_per_origin(self):
        department = Department.objects.get(name='La Paz')
        client = APIClient()
        first = client.post('/api/directorio-iglesias/', {'name': 'Nueva Esperanza', 'department': department.id}, format='json', REMOTE_ADDR='198.51.100.10')
        self.assertEqual(first.status_code, 201, first.data)
        self.assertTrue(ChurchRegistrationOrigin.objects.filter(church_id=first.data['id']).exists())
        second = client.post('/api/directorio-iglesias/', {'name': 'Otra Iglesia', 'department': department.id}, format='json', REMOTE_ADDR='198.51.100.10')
        self.assertEqual(second.status_code, 429, second.data)
        self.assertEqual(client.get('/api/directorio-iglesias/').status_code, 200)

    def test_pastor_cannot_manage_users(self):
        self.api.force_authenticate(self.pastor)
        self.assertEqual(self.api.get('/api/usuarios/').status_code, 403)

    def test_only_admin_can_grant_or_revoke_access(self):
        self.member.email = 'ana@example.com'
        self.member.identity_card = '00123456'
        self.member.save(update_fields=['email', 'identity_card'])
        self.pastor.email = self.member.email
        self.pastor.is_active = False
        self.pastor.save(update_fields=['email', 'is_active'])
        self.api.force_authenticate(self.pastor)
        self.assertEqual(self.api.post('/api/accesos/', {'member': self.member.id}, format='json').status_code, 403)
        self.api.force_authenticate(self.admin)
        response = self.api.post('/api/accesos/', {'member': self.member.id}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.pastor.refresh_from_db()
        self.assertTrue(self.pastor.is_active)
        self.assertEqual(self.pastor.role, 'pastor')
        self.assertEqual(self.api.post(f'/api/accesos/{self.pastor.id}/revocar/').status_code, 200)
        self.pastor.refresh_from_db()
        self.assertFalse(self.pastor.is_active)

    def test_member_access_requires_email_and_is_read_only(self):
        new_member = Member.objects.create(names='Luis', email='', identity_card='00123457')
        self.assertEqual(self.api.post('/api/accesos/', {'member': new_member.id}, format='json').status_code, 400)
        new_member.email = 'luis@example.com'
        new_member.save(update_fields=['email'])
        result = self.api.post('/api/accesos/', {'member': new_member.id}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        account = User.objects.get(member=new_member)
        self.assertEqual(account.role, 'miembro')
        self.assertFalse(account.has_usable_password())
        self.assertFalse(account.temporary_password)
        self.api.force_authenticate(account)
        self.assertEqual(self.api.get('/api/miembros/').status_code, 200)
        self.assertEqual(self.api.post('/api/iglesias/', {'name': 'Otra', 'department': Department.objects.first().id}).status_code, 403)
        self.assertEqual(self.api.get('/api/accesos/').status_code, 403)

    def test_cannot_grant_an_email_already_used_by_another_account(self):
        other = Member.objects.create(names='Otro', email=self.admin.email, identity_card='900123')
        self.assertEqual(self.api.post('/api/accesos/', {'member': other.id}, format='json').status_code, 409)

    def test_new_access_cannot_login_with_carnet_password(self):
        member = Member.objects.create(names='Luis', email='luis@example.com', identity_card='00123457')
        result = self.api.post('/api/accesos/', {'member': member.id}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        client = Client(enforce_csrf_checks=True)
        csrf = client.get('/api/auth/csrf/').json()['csrfToken']
        for identifier in ('00123457', 'luis@example.com'):
            result = client.post('/api/auth/login/', {'username': identifier, 'password': '00123457'}, content_type='application/json', HTTP_X_CSRFTOKEN=csrf)
            self.assertEqual(result.status_code, 401, result.content)

    def test_member_sees_only_own_data_and_events(self):
        from core_api.models import Baptism, Marriage
        other = Member.objects.create(names='Otra persona', identity_card='999')
        account = self.pastor
        account.role = 'miembro'
        account.save(update_fields=['role'])
        Baptism.objects.create(member=self.member)
        Baptism.objects.create(member=other)
        marriage = Marriage.objects.create(member=other, spouse_member=self.member)
        self.api.force_authenticate(account)
        self.assertEqual(self.api.get('/api/miembros/').data['count'], 1)
        self.assertEqual(self.api.get(f'/api/miembros/{other.pk}/').status_code, 404)
        self.assertEqual(self.api.get('/api/bautismos/').data['count'], 1)
        self.assertEqual(self.api.get('/api/matrimonios/').data['results'][0]['id'], marriage.pk)
        self.assertEqual(self.api.get('/api/pastores/').data['count'], 0)
        self.assertEqual(self.api.get('/api/usuarios/').status_code, 403)

    @override_settings(LOGIN_RATE_LIMIT=2)
    def test_login_rate_limit(self):
        client = Client(enforce_csrf_checks=True)
        csrf = client.get('/api/auth/csrf/').json()['csrfToken']
        for _ in range(2):
            self.assertEqual(client.post('/api/auth/login/', {'username': 'admin', 'password': 'incorrect'}, content_type='application/json', HTTP_X_CSRFTOKEN=csrf).status_code, 401)
        response = client.post('/api/auth/login/', {'username': 'admin', 'password': 'incorrect'}, content_type='application/json', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 429)
        self.assertIn('Retry-After', response)

    def test_unlinked_member_cannot_see_marriages_without_spouse(self):
        from core_api.models import Marriage
        Marriage.objects.create(member=self.member)
        account = User.objects.create_user(username='sin-ficha', email='sin-ficha@example.com', role='miembro')
        self.api.force_authenticate(account)
        self.assertEqual(self.api.get('/api/matrimonios/').data['count'], 0)

    def test_session_login_requires_csrf(self):
        client = Client(enforce_csrf_checks=True)
        payload = '{"username":"admin","password":"Test-password-928"}'
        self.assertEqual(client.post('/api/auth/login/', payload, content_type='application/json').status_code, 403)
        csrf = client.get('/api/auth/csrf/').json()['csrfToken']
        response = client.post('/api/auth/login/', payload, content_type='application/json', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(client.get('/api/miembros/').status_code, 200)

    def test_public_registration_creates_pastor_member_without_login_access(self):
        client = Client(enforce_csrf_checks=True)
        csrf = client.get('/api/auth/csrf/').json()['csrfToken']
        payload = {'names': 'María', 'paternal_surname': 'Quispe', 'identity_card': '1234567', 'gender': 'mujer', 'birth_date': '1990-04-12', 'email': 'maria@example.com', 'is_pastor': True, 'baptized': True, 'baptism_month': 5, 'baptism_year': 2015, 'father_identity_card': '000123', 'privacy_consent': True}
        response = client.post('/api/registro/', payload, content_type='application/json', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 201, response.content)
        member = Member.objects.get(pk=response.json()['id'])
        self.assertEqual(member.father_identity_card, '000123')
        self.assertEqual(member.baptisms.count(), 1)
        self.assertEqual(member.account.role, 'pastor')
        self.assertFalse(member.account.is_active)
        self.assertFalse(member.account.has_usable_password())
        self.assertTrue(self.api.get('/api/pastores/').data['results'][0]['member'])
        self.assertEqual(self.api.get('/api/miembros/').data['count'], 2)

    def test_registration_rejects_missing_required_fields_and_invalid_id(self):
        client = APIClient()
        result = client.post('/api/registro/', {'names': '  ', 'identity_card': '12LP'}, format='json')
        self.assertEqual(result.status_code, 400)
        self.assertIn('names', result.data)
        self.assertIn('identity_card', result.data)

    def test_public_record_lookup_requires_matching_identity_and_birth_date(self):
        member = Member.objects.create(names='Ana', paternal_surname='López', identity_card='445566', birth_date='1990-01-02', phone='+59170000000', email='ana@example.com')
        client = APIClient()
        response = client.post('/api/consulta-ficha/', {'identity_card': member.identity_card, 'birth_date': '1990-01-02'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['names'], 'Ana')
        self.assertNotIn('phone', response.data)
        self.assertEqual(client.post('/api/consulta-ficha/', {'identity_card': member.identity_card, 'birth_date': '1990-01-03'}, format='json').status_code, 404)

    def test_own_record_edits_are_audited_and_restricted(self):
        from core_api.models import MemberChange
        self.api.force_authenticate(self.pastor)
        response = self.api.patch('/api/mi-ficha/', {'occupation': 'Docente'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        change = MemberChange.objects.get(member=self.member)
        self.assertEqual(change.actor, self.pastor)
        self.assertEqual(change.changes['occupation'], {'before': '', 'after': 'Docente'})
        response = self.api.get('/api/mi-ficha/')
        self.assertEqual(response.data['history'][0]['changes']['occupation']['after'], 'Docente')
        self.assertEqual(self.api.patch('/api/mi-ficha/', {'identity_card': '123'}, format='json').status_code, 400)
        self.assertEqual(MemberChange.objects.count(), 1)
        self.api.force_authenticate(None)
        self.assertIn(self.api.patch('/api/mi-ficha/', {'occupation': 'Otra'}, format='json').status_code, (401, 403))

    def test_lookup_grants_temporary_member_edit_and_audits(self):
        from core_api.models import MemberChange
        member = Member.objects.create(names='Ana', paternal_surname='Paz', identity_card='122334', birth_date='1990-01-02')
        client = APIClient(enforce_csrf_checks=True)
        csrf = client.get('/api/auth/csrf/').json()['csrfToken']
        lookup = {'identity_card': '122334', 'birth_date': '1990-01-02'}
        self.assertEqual(client.patch('/api/mi-ficha/', {'occupation': 'Docente'}, format='json', HTTP_X_CSRFTOKEN=csrf).status_code, 403)
        self.assertEqual(client.post('/api/consulta-ficha/', lookup, format='json', HTTP_X_CSRFTOKEN=csrf).status_code, 200)
        self.assertEqual(client.get('/api/mi-ficha/').data['member']['names'], 'Ana')
        self.assertEqual(client.patch('/api/mi-ficha/', {'occupation': 'Docente'}, format='json').status_code, 403)
        self.assertEqual(client.patch('/api/mi-ficha/', {'occupation': 'Docente'}, format='json', HTTP_X_CSRFTOKEN=csrf).status_code, 200)
        change = MemberChange.objects.get(member=member)
        self.assertIsNone(change.actor)
        self.assertEqual(change.changes['occupation']['after'], 'Docente')
        self.assertEqual(client.patch('/api/mi-ficha/', {'identity_card': '987'}, format='json', HTTP_X_CSRFTOKEN=csrf).status_code, 400)
        session = client.session
        session['member_lookup_grant'] = {'member_id': member.pk, 'expires': 1}
        session.save()
        self.assertEqual(client.get('/api/mi-ficha/').status_code, 403)

    def test_own_religion_can_be_completed_and_is_audited(self):
        from core_api.models import MemberChange, Baptism, Admission, Church, Department
        department = Department.objects.create(name='Departamento de prueba')
        church = Church.objects.create(name='Iglesia de prueba', department=department)
        member = Member.objects.create(names='Ana', paternal_surname='Paz', identity_card='1234567', birth_date='1990-01-02')
        client = APIClient()
        client.post('/api/consulta-ficha/', {'identity_card': '1234567', 'birth_date': '1990-01-02'}, format='json')
        data = {'religion': {'church': church.pk, 'baptized': True, 'baptism_month': 5, 'baptism_year': 2005, 'pastor_name': 'Pastor Pérez', 'admission_method': 'bautismo'}}
        response = client.patch('/api/mi-ficha/', data, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        member.refresh_from_db()
        self.assertEqual(member.church, church)
        self.assertEqual(Baptism.objects.get(member=member).pastor_name, 'Pastor Pérez')
        self.assertEqual(Admission.objects.get(member=member).method, 'bautismo')
        self.assertEqual(MemberChange.objects.get(member=member).changes['religion.baptized']['after'], True)
        data['religion']['baptism_year'] = 1800
        self.assertEqual(client.patch('/api/mi-ficha/', data, format='json').status_code, 400)
        self.assertEqual(Baptism.objects.get(member=member).year, 2005)
        baptism = Baptism.objects.get(member=member)
        baptism.notes = 'Registro con información adicional'
        baptism.save(update_fields=['notes'])
        data['religion'].update({'baptized': False, 'baptism_month': None, 'baptism_year': None, 'pastor_name': '', 'admission_method': ''})
        self.assertEqual(client.patch('/api/mi-ficha/', data, format='json').status_code, 400)
        self.assertTrue(Baptism.objects.filter(pk=baptism.pk).exists())

    def test_own_record_updates_family_cards_and_department_with_history(self):
        from core_api.models import Department, MemberChange
        department = Department.objects.create(name='Departamento nuevo')
        parent = Member.objects.create(names='Padre', identity_card='98765')
        member = Member.objects.create(names='Ana', paternal_surname='Paz', identity_card='12345', birth_date='1990-01-02')
        client = APIClient()
        client.post('/api/consulta-ficha/', {'identity_card': '12345', 'birth_date': '1990-01-02'}, format='json')
        response = client.patch('/api/mi-ficha/', {'department': department.pk, 'father_identity_card': '98765', 'mother_identity_card': '112233', 'spouse_identity_card': '445566'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        member.refresh_from_db()
        self.assertEqual(member.father, parent)
        self.assertEqual(member.department_id, department.pk)
        self.assertEqual(response.data['history'][0]['changes']['mother_identity_card']['after'], '112233')
        self.assertEqual(MemberChange.objects.get(member=member).changes['department']['after'], department.pk)
        self.assertEqual(client.patch('/api/mi-ficha/', {'mother_identity_card': '98765'}, format='json').status_code, 400)
        self.assertEqual(client.patch('/api/mi-ficha/', {'spouse_identity_card': '12345'}, format='json').status_code, 400)
        self.assertEqual(client.patch('/api/mi-ficha/', {'father_identity_card': ''}, format='json').status_code, 200)
        member.refresh_from_db()
        self.assertIsNone(member.father_id)

    def test_registration_rejects_under_one_and_duplicate_id(self):
        from django.utils import timezone
        data = {'names': 'Juan', 'paternal_surname': 'Pérez', 'identity_card': '123', 'gender': 'hombre', 'birth_date': str(timezone.localdate()), 'privacy_consent': True}
        client = APIClient()
        self.assertEqual(client.post('/api/registro/', data, format='json').status_code, 400)
        data['birth_date'] = '1990-01-01'
        self.assertEqual(client.post('/api/registro/', data, format='json').status_code, 201)
        self.assertEqual(client.post('/api/registro/', data, format='json').status_code, 400)

    def test_registration_rejects_officiating_pastor_when_not_baptized(self):
        payload = {'names': 'Julia', 'paternal_surname': 'Paz', 'identity_card': '9876543', 'gender': 'mujer', 'birth_date': '1990-01-01', 'baptized': False, 'pastor_name': 'Pastor Ejemplo', 'privacy_consent': True}
        response = APIClient().post('/api/registro/', payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('pastor_name', response.data)

    def test_family_relationship_links_when_parent_registers_later(self):
        client = APIClient()
        child_data = {'names': 'Hija', 'paternal_surname': 'Quispe', 'identity_card': '122', 'gender': 'mujer', 'birth_date': '2000-01-01', 'father_identity_card': '144', 'privacy_consent': True}
        child = client.post('/api/registro/', child_data, format='json')
        self.assertEqual(child.status_code, 201, child.data)
        parent_data = {'names': 'Padre', 'paternal_surname': 'Quispe', 'identity_card': '144', 'gender': 'hombre', 'birth_date': '1970-01-01', 'privacy_consent': True}
        parent = client.post('/api/registro/', parent_data, format='json')
        self.assertEqual(parent.status_code, 201, parent.data)
        self.assertEqual(Member.objects.get(pk=child.data['id']).father_id, parent.data['id'])

    def test_marriage_stores_both_members_and_rejects_reverse_duplicate(self):
        other = Member.objects.create(names='Pablo', identity_card='777')
        data = {'member': self.member.pk, 'spouse_member': other.pk, 'date': '2020-01-01', 'pastor': self.pastor.pk}
        self.assertEqual(self.api.post('/api/matrimonios/', data, format='json').status_code, 201)
        data['member'], data['spouse_member'] = other.pk, self.member.pk
        self.assertEqual(self.api.post('/api/matrimonios/', data, format='json').status_code, 400)

    def test_death_records_status_and_rejects_future_dates(self):
        from datetime import timedelta
        from django.utils import timezone
        data = {'member': self.member.pk, 'date': str(timezone.localdate() + timedelta(days=1))}
        self.assertEqual(self.api.post('/api/fallecimientos/', data, format='json').status_code, 400)
        data['date'] = '2020-01-01'
        self.assertEqual(self.api.post('/api/fallecimientos/', data, format='json').status_code, 201)
        self.member.refresh_from_db()
        self.assertEqual(self.member.status, 'fallecido')


@override_settings(GOOGLE_OAUTH_CLIENT_ID='test-client', GOOGLE_OAUTH_CLIENT_SECRET='test-secret', GOOGLE_OAUTH_REDIRECT_URI='http://localhost:8000/api/auth/google/callback/', FRONTEND_URL='http://localhost:5173')
class GoogleOAuthTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='usuario_real', email='user@example.com', password='safe-password-123', role='administrador')

    @override_settings(CORS_ALLOWED_ORIGINS=['http://localhost:5173'])
    @patch('modules.accounts.infrastructure.google_oauth.verified_identity')
    def test_registration_google_returns_email_without_logging_in(self, verify):
        from urllib.parse import parse_qs, urlsplit
        from django.core import signing
        self.assertEqual(self.client.get('/api/auth/google/registration/', {'origin': 'https://evil.example'}).status_code, 403)
        start = self.client.get('/api/auth/google/registration/', {'origin': 'http://localhost:5173', 'channel': 'a' * 32})
        self.assertEqual(start.status_code, 302)
        flow = self.client.session['google_oauth']
        verify.return_value = {'email': 'New@example.com', 'sub': 'google-id', 'email_verified': True}
        response = self.client.get('/api/auth/google/callback/', {'state': flow['state'], 'code': 'valid'})
        self.assertEqual(response.status_code, 302)
        target = urlsplit(response.url)
        self.assertEqual(target.path, '/')
        self.assertEqual(parse_qs(target.query)['google_registration'], ['success'])
        fragment = parse_qs(target.fragment)
        self.assertEqual(fragment['email'], ['new@example.com'])
        self.assertEqual(fragment['channel'], ['a' * 32])
        self.assertEqual(signing.loads(fragment['proof'][0], salt='member-registration-google-email'), {'email': 'new@example.com'})
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        self.assertFalse(User.objects.filter(email__iexact='new@example.com').exists())

    def test_public_member_registration_requires_a_signed_matching_google_email(self):
        from django.core import signing
        from unittest.mock import patch
        client = APIClient()
        url = '/api/registro/'
        payload = {'email': 'verified@example.com'}
        self.assertEqual(client.post(url, payload, format='json').status_code, 400)
        payload['google_email_proof'] = 123
        self.assertEqual(client.post(url, payload, format='json').status_code, 400)
        payload['google_email_proof'] = signing.dumps({'email': 'another@example.com'}, salt='member-registration-google-email')
        mismatch = client.post(url, payload, format='json')
        self.assertEqual(mismatch.status_code, 400)
        self.assertIn('no coincide', mismatch.data['email'])
        valid_payload = {
            'names': 'Andrea', 'paternal_surname': 'Rojas', 'identity_card': '8877665',
            'gender': 'mujer', 'birth_date': '1990-04-12', 'email': 'verified@example.com',
            'privacy_consent': True,
            'google_email_proof': signing.dumps({'email': 'verified@example.com'}, salt='member-registration-google-email'),
        }
        created = client.post(url, valid_payload, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        payload['email'] = 'verified@example.com'
        with patch('django.core.signing.time.time', return_value=10000):
            payload['google_email_proof'] = signing.dumps({'email': 'verified@example.com'}, salt='member-registration-google-email')
        with patch('django.core.signing.time.time', return_value=13601):
            expired = client.post(url, payload, format='json')
        self.assertEqual(expired.status_code, 400)
        self.assertIn('Verifica tu correo', expired.data['email'])

    @override_settings(CORS_ALLOWED_ORIGINS=['http://localhost:5173'])
    @patch('modules.accounts.infrastructure.google_oauth.verified_identity')
    def test_registration_google_rejects_bad_state(self, verify):
        self.client.get('/api/auth/google/registration/', {'origin': 'http://localhost:5173', 'channel': 'a' * 32})
        response = self.client.get('/api/auth/google/callback/', {'state': 'invalid', 'code': 'valid'})
        self.assertIn('google_registration=error', response.url)
        verify.assert_not_called()

    @patch('modules.accounts.infrastructure.google_oauth.verified_identity')
    def test_google_login_links_existing_user_and_photo(self, verify):
        self.user.set_password('123456')
        self.user.temporary_password = True
        self.user.save(update_fields=['password', 'temporary_password'])
        start = self.client.get('/api/auth/google/start/')
        self.assertEqual(start.status_code, 302)
        flow = self.client.session['google_oauth']
        verify.return_value = {'email': 'user@example.com', 'sub': 'google-subject', 'email_verified': True, 'picture': 'https://lh3.googleusercontent.com/example'}
        response = self.client.get('/api/auth/google/callback/', {'state': flow['state'], 'code': 'valid'})
        self.assertRedirects(response, 'http://localhost:5173/?google_login=success', fetch_redirect_response=False)
        me = self.client.get('/api/auth/me/').json()
        self.assertEqual(me['username'], 'usuario_real')
        self.assertEqual(me['picture'], 'https://lh3.googleusercontent.com/example')
        self.user.refresh_from_db()
        self.assertEqual(self.user.google_subject, 'google-subject')
        self.assertFalse(self.user.has_usable_password())
        self.assertFalse(self.user.temporary_password)

    @patch('modules.accounts.infrastructure.google_oauth.verified_identity')
    def test_unknown_or_inactive_google_account_cannot_login(self, verify):
        self.client.get('/api/auth/google/start/')
        flow = self.client.session['google_oauth']
        verify.return_value = {'email': 'unknown@example.com', 'sub': 'other', 'email_verified': True}
        response = self.client.get('/api/auth/google/callback/', {'state': flow['state'], 'code': 'valid'})
        self.assertIn('google_error=unauthorized', response.url)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    @patch('modules.accounts.infrastructure.google_oauth.verified_identity')
    def test_invalid_state_does_not_exchange_code(self, verify):
        self.client.get('/api/auth/google/start/')
        response = self.client.get('/api/auth/google/callback/', {'state': 'wrong', 'code': 'valid'})
        self.assertIn('google_error=invalid', response.url)
        verify.assert_not_called()

    @patch('modules.accounts.infrastructure.google_oauth.id_token.verify_oauth2_token')
    @patch('modules.accounts.infrastructure.google_oauth.requests.post')
    def test_identity_verification_checks_nonce_and_verified_email(self, post, verify):
        from modules.accounts.infrastructure.google_oauth import verified_identity
        post.return_value.json.return_value = {'id_token': 'signed-token'}
        flow = {'verifier': 'verifier', 'nonce': 'expected'}
        verify.return_value = {'nonce': 'expected', 'email_verified': True, 'email': 'user@example.com', 'sub': '123'}
        self.assertEqual(verified_identity('code', flow)['sub'], '123')
        verify.return_value['nonce'] = 'different'
        with self.assertRaises(ValueError):
            verified_identity('code', flow)
        verify.return_value['nonce'] = 'expected'
        verify.return_value['email_verified'] = False
        with self.assertRaises(ValueError):
            verified_identity('code', flow)

    @patch('modules.accounts.infrastructure.google_oauth.verified_identity')
    def test_temporary_carnet_session_must_link_matching_google(self, verify):
        member = Member.objects.create(names='Pastor', identity_card='14049391')
        user = User.objects.create_user(username='pastor-ci', email='pastor@example.com', password='14049391', member=member, role='pastor', temporary_password=True)
        client = Client(enforce_csrf_checks=True)
        csrf = client.get('/api/auth/csrf/').json()['csrfToken']
        response = client.post('/api/auth/login/', {'username': '14049391', 'password': '14049391'}, content_type='application/json', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 401)
        client.force_login(user)
        csrf = client.get('/api/auth/csrf/').json()['csrfToken']
        self.assertEqual(client.get('/api/miembros/').status_code, 403)
        self.assertEqual(client.post('/api/auth/google/link/').status_code, 403)
        self.assertEqual(client.post('/api/auth/google/link/', HTTP_X_CSRFTOKEN=csrf).status_code, 200)
        flow = client.session['google_oauth']
        verify.return_value = {'email': 'otra@example.com', 'sub': 'wrong-account'}
        response = client.get('/api/auth/google/callback/', {'state': flow['state'], 'code': 'valid'})
        self.assertIn('google_error=unauthorized', response.url)
        user.refresh_from_db()
        self.assertTrue(user.temporary_password)
        self.assertEqual(client.get('/api/miembros/').status_code, 403)
        self.assertEqual(client.post('/api/auth/google/link/', HTTP_X_CSRFTOKEN=csrf).status_code, 200)
        flow = client.session['google_oauth']
        verify.return_value = {'email': 'pastor@example.com', 'sub': 'right-account'}
        response = client.get('/api/auth/google/callback/', {'state': flow['state'], 'code': 'valid'})
        self.assertIn('google_login=success', response.url)
        user.refresh_from_db()
        self.assertFalse(user.has_usable_password())
        self.assertFalse(user.temporary_password)
        self.assertEqual(client.get('/api/miembros/').status_code, 200)
