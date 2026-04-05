import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./rental-dashboard/rental-dashboard.component').then(m => m.RentalDashboardComponent),
    title: 'Tableau de Bord Location'
  },
  {
    path: 'leases',
    loadComponent: () => import('./leases/leases.component').then(m => m.LeasesComponent),
    title: 'Contrats de Location'
  },
  {
    path: 'tenants',
    loadComponent: () => import('./rental-tenants/rental-tenants.component').then(m => m.RentalTenantsComponent),
    title: 'Registre des Locataires'
  },
  {
    path: 'housing-units',
    loadComponent: () => import('./housing-units/housing-units.component').then(m => m.HousingUnitsComponent),
    title: 'Unités de Logement'
  },
  {
    path: 'buildings',
    loadComponent: () => import('./buildings/buildings.component').then(m => m.BuildingsComponent),
    title: 'Bâtiments'
  },
  {
    path: 'locations',
    loadComponent: () => import('./locations/locations.component').then(m => m.LocationsComponent),
    title: 'Emplacements'
  },
  {
    path: 'floors',
    loadComponent: () => import('./floors/floors.component').then(m => m.FloorsComponent),
    title: 'Étages'
  },
  {
    path: 'unit-configurations',
    loadComponent: () => import('./unit-configurations/unit-configurations.component').then(m => m.UnitConfigurationsComponent),
    title: 'Configurations d\'Unités'
  }
];
