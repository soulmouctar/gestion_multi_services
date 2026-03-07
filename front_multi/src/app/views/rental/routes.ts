import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'locations',
    pathMatch: 'full'
  },
  {
    path: 'properties',
    loadComponent: () => import('./properties/property-list.component').then(m => m.PropertyListComponent),
    title: 'Biens Immobiliers'
  },
  {
    path: 'locations',
    loadComponent: () => import('./locations/locations.component').then(m => m.LocationsComponent),
    title: 'Emplacements'
  },
  {
    path: 'buildings',
    loadComponent: () => import('./buildings/buildings.component').then(m => m.BuildingsComponent),
    title: 'Bâtiments'
  },
  {
    path: 'floors',
    loadComponent: () => import('./floors/floors.component').then(m => m.FloorsComponent),
    title: 'Étages'
  },
  {
    path: 'housing-units',
    loadComponent: () => import('./housing-units/housing-units.component').then(m => m.HousingUnitsComponent),
    title: 'Unités de Logement'
  },
  {
    path: 'unit-configurations',
    loadComponent: () => import('./unit-configurations/unit-configurations.component').then(m => m.UnitConfigurationsComponent),
    title: 'Configurations d\'Unités'
  },
  {
    path: 'locations-advanced',
    loadComponent: () => import('./locations-advanced/locations-advanced.component').then(m => m.LocationsAdvancedComponent),
    title: 'Gestion Avancée des Emplacements'
  }
];
