from datetime import date

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core_api.models import Church, Department, Member
from core_api.serializers import RegistrationSerializer, MarriageSerializer, DeathSerializer


class Command(BaseCommand):
    help = 'Crea registros ficticios identificados como PRUEBA, sin modificar los registros existentes.'

    @transaction.atomic
    def handle(self, *args, **options):
        identities = [str(980000001 + index) for index in range(36)]
        if Member.objects.filter(identity_card__in=identities).exists():
            raise CommandError('Uno de los carnets de prueba ya existe. No se ha modificado ningún dato.')
        department_names = ['Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro', 'Pando', 'Potosí', 'Santa Cruz', 'Tarija']
        departments = [Department.objects.get_or_create(name=name)[0] for name in department_names]
        churches = []
        for department in departments:
            church, created = Church.objects.get_or_create(department=department, name='Iglesia de PRUEBA')
            if not created:
                raise CommandError('Ya existe una iglesia de prueba; no se han creado datos.')
            churches.append(church)
        names = ['Ana', 'Luis', 'María', 'Daniel', 'Rosa', 'David', 'Elena', 'Samuel', 'Sara', 'José', 'Marta', 'Pablo']
        educations = ['Primaria', 'Secundaria', 'Formación técnica', 'Universitaria', 'Licenciatura', 'Especialidad o diplomado', 'Maestría', 'Doctorado', 'Sin educación formal', 'Otro']
        statuses = ['Soltero(a)', 'Casado(a)', 'Unión libre', 'Divorciado(a)', 'Viudo(a)']
        today = timezone.localdate()
        people = []
        for index, identity in enumerate(identities):
            department = departments[index % len(departments)]
            born = date(today.year - (20 + index % 55), 1 + index % 12, 1 + index % 27)
            data = dict(names=names[index % len(names)], paternal_surname='PRUEBA', maternal_surname='Ejemplo', identity_card=identity,
                        birth_date=born, birth_place=department.name, gender='mujer' if index % 2 == 0 else 'hombre',
                        marital_status=statuses[index % len(statuses)], education_level=educations[index % len(educations)],
                        occupation=['Docente', 'Comerciante', 'Profesional', 'Estudiante'][index % 4], phone=f'700{index:05d}',
                        email=f'persona.prueba.{index + 1}@example.com', address=f'Domicilio ficticio {index + 1}', department=department.pk,
                        church=churches[index % len(churches)].pk, previous_faith='Dato de prueba', father_name='Padre Ejemplo',
                        mother_name='Madre Ejemplo', is_pastor=index < 2, baptized=True, baptism_month=1 + index % 12,
                        baptism_year=born.year + 18, admission_method='bautismo')
            serializer = RegistrationSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            people.append(serializer.save())
        # Parentesco real entre registros ficticios, respetando el orden de edades.
        child, father, mother = people[0], people[25], people[26]
        child.father, child.father_name, child.father_identity_card = father, str(father), father.identity_card
        child.mother, child.mother_name, child.mother_identity_card = mother, str(mother), mother.identity_card
        child.full_clean(); child.save()
        pastor = people[0].account
        for index in range(0, 16, 2):
            first, second = people[index], people[index + 1]
            first.marital_status = second.marital_status = 'Casado(a)'
            first.spouse_name, first.spouse_identity_card = str(second), second.identity_card
            second.spouse_name, second.spouse_identity_card = str(first), first.identity_card
            first.full_clean(); second.full_clean(); first.save(); second.save()
            serializer = MarriageSerializer(data={'member': first.pk, 'spouse_member': second.pk, 'date': date(today.year - 1, 3, 15), 'church': first.church_id, 'pastor': pastor.pk, 'notes': 'Registro ficticio de PRUEBA'})
            serializer.is_valid(raise_exception=True); serializer.save()
        for person in people[-3:]:
            serializer = DeathSerializer(data={'member': person.pk, 'date': date(today.year - 1, 6, 15), 'notes': 'Registro ficticio de PRUEBA'})
            serializer.is_valid(raise_exception=True); serializer.save()
        # El formulario de registro ya creó bautismos; se completa su información.
        for person in people:
            baptism = person.baptisms.get()
            baptism.pastor, baptism.pastor_name, baptism.church = pastor, str(pastor.member), person.church
            baptism.date = date(baptism.year, baptism.month, 1)
            baptism.place, baptism.notes = 'Lugar ficticio', 'Registro ficticio de PRUEBA'
            baptism.full_clean(); baptism.save()
        self.stdout.write(self.style.SUCCESS(f'Se crearon {len(people)} miembros, 2 pastores, {len(churches)} iglesias, 36 bautizos, 8 matrimonios y 3 fallecimientos de prueba.'))
