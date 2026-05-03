import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BadgeModule, ButtonModule, CardModule, GridModule } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

interface SettingsShortcut {
  title: string;
  description: string;
  link: string;
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'info' | 'danger' | 'secondary';
}

interface SettingsSection {
  title: string;
  subtitle: string;
  badge: string;
  tone: 'primary' | 'success' | 'warning' | 'info' | 'danger' | 'secondary';
  icon: string;
  items: Array<{
    label: string;
    note: string;
    link: string;
  }>;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BadgeModule,
    ButtonModule,
    CardModule,
    GridModule,
    IconDirective
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  readonly heroCounters = [
    { label: 'Organisation', value: '1 centre' },
    { label: 'Paramètres clés', value: '4 blocs' },
    { label: 'Raccourcis', value: '8 accès' }
  ];

  readonly shortcuts: SettingsShortcut[] = [
    {
      title: 'Informations société',
      description: 'Nom, identité visuelle, coordonnées et adresse principale.',
      link: '/organisation/settings',
      icon: 'cilBuilding',
      tone: 'primary'
    },
    {
      title: 'Contacts & adresses',
      description: 'Emails, téléphones, adresses et canaux officiels.',
      link: '/organisation/contacts',
      icon: 'cilAddressBook',
      tone: 'info'
    },
    {
      title: 'En-têtes de facture',
      description: 'Logo, signature, cachet et mentions légales.',
      link: '/organisation/invoice-headers',
      icon: 'cilDescription',
      tone: 'warning'
    },
    {
      title: 'Devises',
      description: 'GNF, USD, EUR et configuration du taux de référence.',
      link: '/organisation/currencies',
      icon: 'cilDollar',
      tone: 'success'
    }
  ];

  readonly sections: SettingsSection[] = [
    {
      title: 'Organisation',
      subtitle: 'Identité et structure de base du tenant.',
      badge: 'Priorité haute',
      tone: 'primary',
      icon: 'cilBuilding',
      items: [
        { label: 'Informations de base', note: 'Nom, email, téléphone et adresse', link: '/organisation/settings' },
        { label: 'Paramètres avancés', note: 'Préférences métier et numérotation', link: '/organisation/settings-advanced' }
      ]
    },
    {
      title: 'Communication',
      subtitle: 'Canaux officiels et documents sortants.',
      badge: 'Opérationnel',
      tone: 'info',
      icon: 'cilEnvelopeOpen',
      items: [
        { label: 'Contacts officiels', note: 'Emails, téléphones, adresses', link: '/organisation/contacts' },
        { label: 'En-têtes facture', note: 'Logo, signature et cachet', link: '/organisation/invoice-headers' }
      ]
    },
    {
      title: 'Sécurité',
      subtitle: 'Accès utilisateurs et gouvernance.',
      badge: 'Contrôle',
      tone: 'danger',
      icon: 'cilShieldAlt',
      items: [
        { label: 'Utilisateurs organisation', note: 'Comptes internes du tenant', link: '/organisation/users' },
        { label: 'Profil personnel', note: 'Mot de passe et identité', link: '/profile' }
      ]
    },
    {
      title: 'Comptabilité',
      subtitle: 'Monnaies et cohérence des documents.',
      badge: 'Finance',
      tone: 'success',
      icon: 'cilDollar',
      items: [
        { label: 'Devises', note: 'GNF, USD, EUR et équivalences', link: '/organisation/currencies' },
        { label: 'Modules système', note: 'Activation des modules autorisés', link: '/admin/modules' }
      ]
    }
  ];

  readonly checklist = [
    'Vérifier le logo et le nom commercial.',
    'Renseigner le cachet et la signature pour les factures.',
    'Valider les devises et les taux de change.',
    'Contrôler les accès utilisateurs du tenant.'
  ];

  getToneClass(tone: SettingsShortcut['tone']): string {
    const map: Record<SettingsShortcut['tone'], string> = {
      primary: 'tone-primary',
      success: 'tone-success',
      warning: 'tone-warning',
      info: 'tone-info',
      danger: 'tone-danger',
      secondary: 'tone-secondary'
    };
    return map[tone];
  }
}
