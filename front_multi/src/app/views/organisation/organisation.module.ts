import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import {
  ButtonDirective,
  ButtonGroupComponent,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  FormControlDirective,
  FormDirective,
  FormLabelDirective,
  FormSelectDirective,
  InputGroupComponent,
  InputGroupTextDirective,
  RowComponent,
  TableDirective,
  TabsComponent,
  TabsContentComponent,
  TabsListComponent,
  TabPanelComponent,
  ModalComponent,
  ModalBodyComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective,
  SpinnerComponent,
  BadgeComponent,
  AlertComponent,
  ProgressComponent,
  ToastComponent,
  ToastBodyComponent,
  ToastHeaderComponent
} from '@coreui/angular';

import { IconDirective } from '@coreui/icons-angular';

import { OrganisationRoutingModule } from './organisation-routing.module';
import { CompanyInfoComponent } from './company-info/company-info.component';
import { ContactsComponent } from './contacts/contacts.component';
import { OrganisationUsersComponent } from './users/organisation-users.component';
import { CurrenciesComponent } from './currencies/currencies.component';
import { InvoiceHeadersComponent } from './invoice-headers/invoice-headers.component';
import { OrganisationSettingsComponent } from './settings/organisation-settings.component';

@NgModule({
  declarations: [
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    OrganisationRoutingModule,
    ButtonDirective,
    ButtonGroupComponent,
    CardBodyComponent,
    CardComponent,
    CardHeaderComponent,
    ColComponent,
    FormControlDirective,
    FormDirective,
    FormLabelDirective,
    FormSelectDirective,
    InputGroupComponent,
    InputGroupTextDirective,
    RowComponent,
    TableDirective,
    TabsComponent,
    TabsContentComponent,
    TabsListComponent,
    TabPanelComponent,
    ModalComponent,
    ModalBodyComponent,
    ModalFooterComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    SpinnerComponent,
    BadgeComponent,
    AlertComponent,
    ProgressComponent,
    ToastComponent,
    ToastBodyComponent,
    ToastHeaderComponent,
    IconDirective
  ]
})
export class OrganisationModule { }
