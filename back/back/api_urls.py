from django.urls import include, path
from rest_framework.routers import DefaultRouter
from core_api import views
from modules.accounts.infrastructure.google_oauth import google_start, google_callback, google_link_start

router = DefaultRouter()
router.register('departamentos', views.DepartmentViewSet)
router.register('iglesias', views.ChurchViewSet)
router.register('miembros', views.MemberViewSet)
router.register('usuarios', views.UserViewSet)
router.register('accesos', views.AccessViewSet, basename='acceso')
router.register('pastores', views.PastorViewSet, basename='pastor')
router.register('admisiones', views.AdmissionViewSet)
router.register('bautismos', views.BaptismViewSet)
router.register('matrimonios', views.MarriageViewSet)
router.register('fallecimientos', views.DeathViewSet)
router.register('separaciones', views.SeparationViewSet)

urlpatterns = [
    path('directorio-iglesias/', views.public_church_directory),
    path('registro/opciones/', views.registration_options),
    path('registro/', views.register_member),
    path('auth/csrf/', views.csrf_token),
    path('auth/me/', views.session_user),
    path('auth/google/start/', google_start),
    path('auth/google/link/', google_link_start),
    path('auth/google/callback/', google_callback),
    path('auth/login/', views.sign_in),
    path('auth/logout/', views.sign_out),
    path('', include(router.urls)),
]
